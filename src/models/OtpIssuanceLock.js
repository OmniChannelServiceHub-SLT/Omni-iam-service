const mongoose = require('mongoose');

const otpIssuanceLockSchema = new mongoose.Schema({
  scopeKey: { type: String, required: true, unique: true },
  cooldownUntil: { type: Date, required: true },
  latestChallengeId: { type: String, required: true },
  revision: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true }
}, { versionKey: false });

otpIssuanceLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpIssuanceLock', otpIssuanceLockSchema);