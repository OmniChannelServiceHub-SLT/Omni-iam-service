const crypto = require('crypto');
const mongoose = require('mongoose');
const Otp = require('../models/Otp');
const { fail } = require('./errors');
const { callProvider } = require('../services/provider');
const digest = (userName, purpose, code) => crypto.createHmac('sha256', process.env.OTP_HASH_SECRET || process.env.JWT_ACCESS_SECRET).update(JSON.stringify([userName, purpose, String(code)])).digest('hex');
async function createOtp(userName, purpose) {
  const dev = process.env.NODE_ENV !== 'production' && process.env.OTP_DEV_MODE === 'true';
  if (!dev && (!process.env.IAM_PROVIDER_OTPDELIVERY_URL || !process.env.IAM_PROVIDER_API_KEY)) fail(503, 'OTP_DELIVERY_NOT_CONFIGURED', 'Configure OTP delivery or explicitly enable local OTP_DEV_MODE.');
  const recent = await Otp.findOne({ userName, createdAt: { $gt: new Date(Date.now() - 60000) } });
  if (recent) fail(429, 'OTP_COOLDOWN', 'Wait 60 seconds before requesting another OTP.');
  const code = String(crypto.randomInt(100000, 1000000));
  await Otp.updateMany({ userName, purpose, consumed: false }, { $set: { consumed: true } });
  const otp = await Otp.create({ userName, purpose, codeHash: digest(userName, purpose, code), expiresAt: new Date(Date.now() + 300000) });
  try {
    if (dev) console.log(`[LOCAL OTP ONLY] id=${otp._id} purpose=${purpose} code=${code}`);
    else {
      const result = await callProvider('OTPDelivery', { recipient: userName, purpose, code, expiresIn: 300 });
      if (result.delivered !== true) fail(502, 'OTP_DELIVERY_FAILED', 'OTP delivery was not confirmed.');
    }
  } catch (e) { await Otp.updateOne({ _id: otp._id }, { $set: { consumed: true } }); throw e; }
  return otp;
}
async function verifyOtp({ id, userName, code, purpose }) {
  if (id && !mongoose.isValidObjectId(id)) fail(400, 'OTP_INVALID', 'Invalid OTP request id.');
  const filter = { purpose, consumed: false, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } };
  if (id) filter._id = id;
  else if (userName) filter.userName = userName;
  else fail(400, 'OTP_INVALID', 'OTP id or user name required.');
  const record = await Otp.findOne(filter).sort({ createdAt: -1 });
  if (!record) fail(400, 'OTP_INVALID', 'OTP invalid, expired, used or locked.');
  const expected = digest(record.userName, purpose, code);
  const used = await Otp.findOneAndUpdate({ ...filter, _id: record._id, codeHash: expected }, { $set: { consumed: true } }, { new: true });
  if (!used) {
    await Otp.updateOne({ _id: record._id, consumed: false, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } });
    fail(400, 'OTP_INVALID', 'OTP invalid, expired, used or locked.');
  }
  return used;
}
module.exports = { createOtp, verifyOtp };
