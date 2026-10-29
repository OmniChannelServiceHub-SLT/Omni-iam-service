process.env.JWT_ACCESS_SECRET = 'test-secret-for-mocked-auth-tests';
process.env.OTP_HASH_SECRET = 'test-otp-secret-for-mocked-auth-tests';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const Otp = require('../src/models/Otp');
const OtpIssuanceLock = require('../src/models/OtpIssuanceLock');
const { createOtp, verifyOtp, reserveOtpIssuance, digest } = require('../src/utils/otp');
const { otpScopeKey } = require('../src/utils/otp');
const refreshService = require('../src/API/refreshToken/service');
const identify = require('../src/middleware/identify.middleware');
const jwt = require('../src/utils/jwt');

function replace(object, key, value) {
  const original = object[key];
  object[key] = value;
  return () => { object[key] = original; };
}

function matches(record, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = record[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date) && !Array.isArray(expected)) {
      return Object.entries(expected).every(([operator, value]) => {
        if (operator === '$gt') return actual > value;
        if (operator === '$lt') return actual < value;
        if (operator === '$lte') return actual <= value;
        return false;
      });
    }
    return String(actual) === String(expected);
  });
}

function otpQuery(records) {
  return {
    sort() { records.sort((a, b) => b.createdAt - a.createdAt || String(b._id).localeCompare(String(a._id))); return this; },
    session() { return this; },
    then(resolve, reject) { return Promise.resolve(records[0] || null).then(resolve, reject); }
  };
}

function installMockTransactions() {
  const original = mongoose.startSession;
  mongoose.startSession = async () => ({ withTransaction: (work) => work({}), endSession: async () => {} });
  return () => { mongoose.startSession = original; };
}

function mockLatestLock(record) {
  return replace(OtpIssuanceLock, 'findOneAndUpdate', async (filter) => {
    if (filter.latestChallengeId !== String(record._id)) return null;
    return { latestChallengeId: String(record._id) };
  });
}

test('MOCK: concurrent OTP issuance reserves one user/purpose/workflow cooldown', async () => {
  const active = new Map();
  const restore = replace(OtpIssuanceLock, 'findOneAndUpdate', async (filter, update) => {
    const current = active.get(filter.scopeKey);
    if (current && current > new Date()) {
      const error = new Error('duplicate key');
      error.code = 11000;
      throw error;
    }
    active.set(filter.scopeKey, update.$set.expiresAt);
    return {};
  });

  try {
    const outcomes = await Promise.allSettled([
      reserveOtpIssuance('user-a', 'WORKFLOW_OTP', { telephoneNo: '0382222802' }),
      reserveOtpIssuance('user-a', 'WORKFLOW_OTP', { telephoneNo: '0382222802' })
    ]);
    assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter((item) => item.status === 'rejected' && item.reason.code === 'OTP_COOLDOWN').length, 1);
    await reserveOtpIssuance('user-a', 'WORKFLOW_OTP', { telephoneNo: '0382222803' });
  } finally { restore(); }
});

test('MOCK: latest consumed/locked OTP blocks fallback to an older challenge', async () => {
  const older = { _id: 'older', userName: 'user-a', purpose: 'REGISTER', consumed: false, attempts: 0, expiresAt: new Date(Date.now() + 60000), createdAt: new Date(Date.now() - 1000), codeHash: digest('user-a', 'REGISTER', '123456') };
  const latest = { _id: 'latest', userName: 'user-a', purpose: 'REGISTER', consumed: true, attempts: 0, expiresAt: new Date(Date.now() + 60000), createdAt: new Date(), codeHash: digest('user-a', 'REGISTER', '654321') };
  const restore = replace(Otp, 'findOne', (filter) => otpQuery([latest, older].filter((record) => matches(record, filter))));
  const restoreTransactions = installMockTransactions();
  try {
    await assert.rejects(verifyOtp({ userName: 'user-a', purpose: 'REGISTER', code: '123456', session: {} }), (error) => error.code === 'OTP_INVALID');
  } finally { restore(); restoreTransactions(); }
});

test('MOCK: old OTP is rejected after resend updates the latest challenge pointer', async () => {
  const record = { _id: '000000000000000000000002', userName: 'user-a', purpose: 'REGISTER', consumed: false, attempts: 0, expiresAt: new Date(Date.now() + 60000), createdAt: new Date(), codeHash: digest('user-a', 'REGISTER', '123456') };
  const restoreOtp = replace(Otp, 'findOne', (filter) => otpQuery(matches(record, filter) ? [record] : []));
  const restoreTransactions = installMockTransactions();
  const restorePointer = replace(OtpIssuanceLock, 'findOneAndUpdate', async (filter) =>
    filter.latestChallengeId === '000000000000000000000003'
      ? { latestChallengeId: '000000000000000000000003' }
      : null
  );
  try {
    await assert.rejects(verifyOtp({ id: record._id, userName: 'user-a', purpose: 'REGISTER', code: '123456', session: {} }), (error) => error.code === 'OTP_INVALID');
    assert.equal(record.consumed, false);
  } finally { restoreOtp(); restoreTransactions(); restorePointer(); }
});

test('MOCK: OTP latest pointer is bound to workflow recipient scope', async () => {
  const record = { _id: '000000000000000000000004', userName: 'user-a', purpose: 'WORKFLOW_OTP', consumed: false, attempts: 0, expiresAt: new Date(Date.now() + 60000), createdAt: new Date(), codeHash: digest('user-a', 'WORKFLOW_OTP', '333333') };
  const restore = replace(OtpIssuanceLock, 'findOneAndUpdate', async (filter) => {
    if (filter.scopeKey !== otpScopeKey('user-a', 'WORKFLOW_OTP', { telephoneNo: '0382222802' })) return null;
    return { latestChallengeId: record._id };
  });
  const { claimLatestOtp } = require('../src/utils/otp');
  try {
    assert.equal(await claimLatestOtp({ userName: 'user-a', purpose: 'WORKFLOW_OTP', scope: { telephoneNo: '0382222803' }, id: record._id, session: {} }), false);
    assert.equal(await claimLatestOtp({ userName: 'user-a', purpose: 'WORKFLOW_OTP', scope: { telephoneNo: '0382222802' }, id: record._id, session: {} }), true);
  } finally { restore(); }
});

test('MOCK: OTP expiry, attempts, purpose and user scope are enforced', async () => {
  const record = { _id: '000000000000000000000005', userName: 'user-a', purpose: 'FORGOT_PASSWORD', consumed: false, attempts: 0, expiresAt: new Date(Date.now() + 60000), createdAt: new Date(), codeHash: digest('user-a', 'FORGOT_PASSWORD', '111111') };
  const restore = replace(Otp, 'findOne', (filter) => otpQuery(matches(record, filter) ? [record] : []));
  const restoreTransactions = installMockTransactions();
  const restoreLock = mockLatestLock(record);
  try {
    await assert.rejects(verifyOtp({ id: record._id, userName: 'user-b', purpose: 'FORGOT_PASSWORD', code: '111111', session: {} }), (error) => error.code === 'OTP_INVALID');
    await assert.rejects(verifyOtp({ userName: 'user-a', purpose: 'REGISTER', code: '111111', session: {} }), (error) => error.code === 'OTP_INVALID');
    record.expiresAt = new Date(Date.now() - 1000);
    await assert.rejects(verifyOtp({ userName: 'user-a', purpose: 'FORGOT_PASSWORD', code: '111111', session: {} }), (error) => error.code === 'OTP_INVALID');
    record.expiresAt = new Date(Date.now() + 60000);
    record.attempts = 5;
    await assert.rejects(verifyOtp({ userName: 'user-a', purpose: 'FORGOT_PASSWORD', code: '111111', session: {} }), (error) => error.code === 'OTP_INVALID');
  } finally { restore(); restoreTransactions(); restoreLock(); }
});

test('MOCK: one concurrent OTP verification consumes exactly once', async () => {
  const record = { _id: '000000000000000000000001', userName: 'user-a', purpose: 'REGISTER', consumed: false, attempts: 0, expiresAt: new Date(Date.now() + 60000), createdAt: new Date(), codeHash: digest('user-a', 'REGISTER', '123456') };
  const originalFindOne = Otp.findOne;
  const restoreTransactions = installMockTransactions();
  const originalUpdate = Otp.findOneAndUpdate;
  const restoreOne = replace(Otp, 'findOne', (filter) => otpQuery(matches(record, filter) ? [record] : []));
  const restoreUpdate = replace(Otp, 'findOneAndUpdate', async (filter, update) => {
    if (!matches(record, filter)) return null;
    Object.assign(record, update.$set);
    return record;
  });
  const restoreAttempts = replace(Otp, 'updateOne', async () => ({ modifiedCount: 0 }));
  const restoreLock = mockLatestLock(record);
  try {
    const results = await Promise.allSettled([
      verifyOtp({ id: record._id, userName: 'user-a', purpose: 'REGISTER', code: '123456', session: {} }),
      verifyOtp({ id: record._id, userName: 'user-a', purpose: 'REGISTER', code: '123456', session: {} })
    ]);
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(record.consumed, true);
  } finally { restoreOne(); restoreUpdate(); restoreAttempts(); restoreLock(); restoreTransactions(); Otp.findOne = originalFindOne; }
});

test('MOCK: concurrent refresh rotates once and failed replacement persistence rolls back', async () => {
  const originalStartSession = mongoose.startSession;
  let tail = Promise.resolve();
  const state = { user: { _id: 'user-id', userName: 'user-a', status: 'ACTIVE', tokenVersion: 4, authRevision: 0, roles: ['CUSTOMER'] }, token: { user: 'user-id', tokenHash: require('../src/utils/jwt').hashToken('old-refresh'), tokenVersion: 4, revoked: false, expiresAt: new Date(Date.now() + 60000) }, failCreate: false };
  mongoose.startSession = async () => ({
    async withTransaction(work) {
      let release;
      const prior = tail;
      tail = new Promise((resolve) => { release = resolve; });
      await prior;
      const snapshot = structuredClone(state);
      try { return await work({}); } catch (error) { Object.assign(state, snapshot); throw error; } finally { release(); }
    },
    async endSession() {}
  });
  const restoreUserFind = replace(User, 'findOne', (filter) => ({ session() { return Promise.resolve(matches(state.user, filter) ? state.user : null); } }));
  const restoreUserUpdate = replace(User, 'findOneAndUpdate', async (filter, update) => {
    if (!matches(state.user, filter)) return null;
    state.user = { ...state.user, authRevision: state.user.authRevision + update.$inc.authRevision };
    return state.user;
  });
  const restoreTokenUpdate = replace(RefreshToken, 'findOneAndUpdate', async (filter, update) => {
    if (!matches(state.token, filter)) return null;
    state.token.revoked = update.$set.revoked;
    return state.token;
  });
  const restoreCreate = replace(RefreshToken, 'create', async (docs) => {
    if (state.failCreate) throw new Error('injected persistence failure');
    state.replacement = docs[0];
    return docs;
  });
  try {
    const req = { body: { UserName: 'user-a', refreshToken: 'old-refresh' } };
    const concurrent = await Promise.allSettled([refreshService.refreshToken(req), refreshService.refreshToken(req)]);
    assert.equal(concurrent.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(concurrent.filter((item) => item.status === 'rejected' && item.reason.code === 'INVALID_REFRESH_TOKEN').length, 1);
    const success = concurrent.find((item) => item.status === 'fulfilled').value;
    assert.deepEqual(Object.keys(success).sort(), ['.expires', '.issued', 'access_token', 'expires_in', 'refresh_token', 'token_type', 'userName'].sort());
    assert.equal(typeof success.expires_in, 'string');
    assert.equal(typeof success['.issued'], 'string');
    assert.equal(typeof success['.expires'], 'string');

    state.token = { user: 'user-id', tokenHash: require('../src/utils/jwt').hashToken('failure-refresh'), tokenVersion: 4, revoked: false, expiresAt: new Date(Date.now() + 60000) };
    state.user.authRevision = 0;
    state.failCreate = true;
    await assert.rejects(refreshService.refreshToken({ body: { UserName: 'user-a', refreshToken: 'failure-refresh' } }), /injected persistence failure/);
    assert.equal(state.token.revoked, false);
    assert.equal(state.user.authRevision, 0);

    state.failCreate = false;
    state.user.status = 'TERMINATED';
    await assert.rejects(refreshService.refreshToken({ body: { UserName: 'user-a', refreshToken: 'failure-refresh' } }), (error) => error.code === 'INVALID_REFRESH_TOKEN');
    state.user.status = 'ACTIVE';
    state.user.tokenVersion = 5;
    await assert.rejects(refreshService.refreshToken({ body: { UserName: 'user-a', refreshToken: 'failure-refresh' } }), (error) => error.code === 'INVALID_REFRESH_TOKEN');
  } finally {
    mongoose.startSession = originalStartSession;
    restoreUserFind(); restoreUserUpdate(); restoreTokenUpdate(); restoreCreate();
  }
});

test('MOCK: bearer identity rejects terminated users and token-version mismatch', async () => {
  const originalFindById = User.findById;
  const originalSecret = process.env.JWT_ACCESS_SECRET;
  const user = { _id: 'user-id', userName: 'user-a', roles: ['CUSTOMER'], tokenVersion: 4, status: 'ACTIVE' };
  User.findById = async () => user;
  async function check(version, status) {
    user.status = status;
    let captured;
    await identify({ headers: { authorization: `Bearer ${jwt.signAccessToken({ ...user, tokenVersion: version })}` } }, {}, (error) => { captured = error; });
    return captured;
  }
  try {
    assert.equal((await check(3, 'ACTIVE')).code, 'UNAUTHORIZED');
    assert.equal((await check(4, 'TERMINATED')).code, 'UNAUTHORIZED');
    let identity;
    user.status = 'ACTIVE';
    await identify({ headers: { authorization: `Bearer ${jwt.signAccessToken(user)}` } }, {}, (error) => { if (!error) identity = true; });
    assert.equal(identity, true);
  } finally {
    User.findById = originalFindById;
    process.env.JWT_ACCESS_SECRET = originalSecret;
  }
});
