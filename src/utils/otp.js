const crypto = require('crypto');
const mongoose = require('mongoose');
const Otp = require('../models/Otp');
const OtpIssuanceLock = require('../models/OtpIssuanceLock');
const { fail } = require('./errors');
const { callProvider } = require('../services/provider');
function otpSecret() {
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!secret) fail(503, 'OTP_NOT_CONFIGURED', 'OTP hashing secret is not configured.');
  return secret;
}
const digest = (userName, purpose, code) => crypto.createHmac('sha256', otpSecret()).update(JSON.stringify([userName, purpose, String(code)])).digest('hex');
function stableScope(scope) {
  if (Array.isArray(scope)) return scope.map(stableScope);
  if (scope && typeof scope === 'object') return Object.fromEntries(Object.keys(scope).sort().map((key) => [key, stableScope(scope[key])]));
  return scope;
}
function otpScopeKey(userName, purpose, scope = {}) {
  return crypto.createHash('sha256')
    .update(JSON.stringify([userName, purpose, stableScope(scope)]))
    .digest('hex');
}
async function reserveOtpIssuance(userName, purpose, scope = {}, { cooldownMs = 60000, challengeId = new mongoose.Types.ObjectId(), challengeTtlMs = 300000 } = {}) {
  const scopeKey = otpScopeKey(userName, purpose, scope);
  const now = new Date();
  try {
    await OtpIssuanceLock.findOneAndUpdate(
      { scopeKey, $or: [{ cooldownUntil: { $lte: now } }, { expiresAt: { $lte: now } }] },
      { $set: { cooldownUntil: new Date(now.getTime() + cooldownMs), latestChallengeId: String(challengeId), expiresAt: new Date(now.getTime() + Math.max(cooldownMs, challengeTtlMs)) }, $setOnInsert: { scopeKey } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code === 11000) fail(429, 'OTP_COOLDOWN', 'Wait 60 seconds before requesting another OTP.');
    throw error;
  }
  return { scopeKey, challengeId };
}
async function isLatestOtp({ userName, purpose, scope = {}, id, session }) {
  let query = OtpIssuanceLock.findOne({ scopeKey: otpScopeKey(userName, purpose, scope), latestChallengeId: String(id) });
  if (session) query = query.session(session);
  return Boolean(await query);
}
async function claimLatestOtp({ userName, purpose, scope = {}, id, session }) {
  const claimed = await OtpIssuanceLock.findOneAndUpdate(
    { scopeKey: otpScopeKey(userName, purpose, scope), latestChallengeId: String(id) },
    { $inc: { revision: 1 } },
    { new: true, session }
  );
  return Boolean(claimed);
}
async function createOtp(userName, purpose, { scope = {} } = {}) {
  const dev = process.env.NODE_ENV === 'development' && process.env.OTP_DEV_MODE === 'true';
  if (!dev && (!process.env.IAM_PROVIDER_OTPDELIVERY_URL || !process.env.IAM_PROVIDER_API_KEY)) fail(503, 'OTP_DELIVERY_NOT_CONFIGURED', 'Configure OTP delivery or explicitly enable local OTP_DEV_MODE.');
  const otpId = new mongoose.Types.ObjectId();
  await reserveOtpIssuance(userName, purpose, scope, { challengeId: otpId });
  const code = String(crypto.randomInt(100000, 1000000));
  await Otp.updateMany({ userName, purpose, consumed: false }, { $set: { consumed: true } });
  const otp = await Otp.create({ _id: otpId, userName, purpose, codeHash: digest(userName, purpose, code), expiresAt: new Date(Date.now() + 300000) });
  try {
    if (dev) console.log(`[LOCAL OTP ONLY] id=${otp._id} purpose=${purpose} code=${code}`);
    else {
      const result = await callProvider('OTPDelivery', { recipient: userName, purpose, code, expiresIn: 300 });
      if (result.delivered !== true) fail(502, 'OTP_DELIVERY_FAILED', 'OTP delivery was not confirmed.');
    }
  } catch (e) { await Otp.updateOne({ _id: otp._id }, { $set: { consumed: true } }); throw e; }
  return otp;
}
async function verifyOtp({ id, userName, code, purpose, session, returnInvalid = false }) {
  if (id && !mongoose.isValidObjectId(id)) fail(400, 'OTP_INVALID', 'Invalid OTP request id.');
  const filter = { purpose };
  if (id) filter._id = id;
  else if (userName) filter.userName = userName;
  else fail(400, 'OTP_INVALID', 'OTP id or user name required.');
  if (id && userName) filter.userName = userName;
  let latestQuery = Otp.findOne(filter);
  if (session) latestQuery = latestQuery.session(session);
  const record = await latestQuery.sort({ createdAt: -1, _id: -1 });
  if (!record || record.consumed || record.attempts >= 5 || record.expiresAt.getTime() <= Date.now()) {
    if (returnInvalid) return null;
    fail(400, 'OTP_INVALID', 'OTP invalid, expired, used or locked.');
  }
  if (!session) fail(500, 'OTP_TRANSACTION_REQUIRED', 'OTP verification requires a MongoDB transaction.');
  if (!(await claimLatestOtp({ userName: record.userName, purpose, id: record._id, session }))) {
    if (returnInvalid) return null;
    fail(400, 'OTP_INVALID', 'OTP invalid, expired, used or locked.');
  }
  const expected = digest(record.userName, purpose, code);
  const usable = { ...filter, _id: record._id, consumed: false, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } };
  const used = await Otp.findOneAndUpdate({ ...usable, codeHash: expected }, { $set: { consumed: true, verifiedAt: new Date() } }, { new: true, session });
  if (!used) {
    await Otp.updateOne({ ...usable, expiresAt: { $gt: new Date() } }, { $inc: { attempts: 1 } }, { session });
    if (returnInvalid) return null;
    fail(400, 'OTP_INVALID', 'OTP invalid, expired, used or locked.');
  }
  return used;
}
module.exports = { createOtp, verifyOtp, reserveOtpIssuance, isLatestOtp, claimLatestOtp, otpScopeKey, digest };
