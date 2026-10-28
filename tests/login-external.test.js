process.env.JWT_ACCESS_SECRET = 'test-secret-for-route-contract-only';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const app = require('../src/app');
const { formatLegacyUtc } = require('../src/API/refreshToken/service');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const loginService = require('../src/API/Login/service');

function replace(object, key, value) {
  const original = object[key];
  object[key] = value;
  return () => { object[key] = original; };
}

test('LoginExternal is mounted and fails closed without a configured verifier', async () => {
  const response = await request(app)
    .post('/internal-api/iam/v4/LoginExternal')
    .send({ provider: 'Apple' });

  assert.equal(response.status, 503);
  assert.equal(response.body.errorCode, 'EXTERNAL_LOGIN_NOT_CONFIGURED');
  assert.equal(response.body.exceptionDetail, null);
});

test('LoginExternal fails closed until provider verification is configured', async () => {
  const response = await request(app)
    .post('/internal-api/iam/v4/LoginExternal')
    .send({ provider: 'Apple', externalAccessToken: 'not-a-real-token' });

  assert.equal(response.status, 503);
  assert.equal(response.body.errorCode, 'EXTERNAL_LOGIN_NOT_CONFIGURED');
  assert.equal(response.body.errorMessege, 'Verified external identity providers are not configured.');
  assert.equal(response.body.exceptionDetail, null);
});

test('GetGoogleAccessToken preserves Gateway GET body and has no invented legacy path', async () => {
  const gatewayResponse = await request(app)
    .get('/internal-api/iam/v4/GetGoogleAccessToken')
    .send({ grant_type: 'authorization_code', code: 'not-real', client_id: 'test', client_secret: 'test' });

  assert.equal(gatewayResponse.status, 503);
  assert.equal(gatewayResponse.body.errorCode, 'GOOGLE_TOKEN_EXCHANGE_NOT_CONFIGURED');

  const legacyResponse = await request(app)
    .get('/api/GetGoogleAccessToken')
    .send({ grant_type: 'authorization_code', code: 'not-real', client_id: 'test', client_secret: 'test' });

  assert.equal(legacyResponse.status, 404);
});

test('provider-dependent protected endpoints require bearer authentication', async () => {
  const response = await request(app)
    .post('/internal-api/iam/v4/CallVoiceOTPRequest')
    .query({ telephoneNo: '0382222802' });

  assert.equal(response.status, 401);
  assert.equal(response.body.exceptionDetail, null);
});

test('Postman collection contains all 19 unique operations', () => {
  const collectionPath = path.join(__dirname, '../docs/Omni IAM Interim APIs.postman_collection.json');
  const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
  const names = collection.item.map((item) => item.name.replace(' (GET with body)', ''));

  assert.equal(names.length, 19);
  assert.equal(new Set(names).size, 19);
});

test('refresh timestamps use the documented UTC string format', () => {
  assert.equal(
    formatLegacyUtc(new Date('2019-11-25T07:13:54.000Z')),
    '11/25/2019 7:13:54 AM +00:00'
  );
});

test('MOCK: Login returns the exact documented bare token shape and types', async () => {
  const user = {
    _id: 'user-id',
    userName: 'user-a',
    passwordHash: await bcrypt.hash('test-password-123', 4),
    status: 'ACTIVE',
    tokenVersion: 2,
    roles: ['CUSTOMER'],
    async save() { return this; }
  };
  const restoreFind = replace(User, 'findOne', async () => user);
  const restoreTokens = replace(RefreshToken, 'create', async () => []);
  try {
    const result = await loginService.Login({ body: { Username: 'user-a', Password: 'test-password-123' } });
    assert.deepEqual(Object.keys(result).sort(), ['accessToken', 'refreshToken', 'user_id', 'name'].sort());
    assert.equal(typeof result.accessToken, 'string');
    assert.equal(typeof result.refreshToken, 'string');
    assert.equal(result.user_id, null);
    assert.equal(result.name, null);
  } finally { restoreFind(); restoreTokens(); }
});