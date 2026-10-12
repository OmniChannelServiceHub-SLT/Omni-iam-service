const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userName: { type: String, required: true, index: true },
  codeHash: { type: String, required: true },
  purpose: { type: String, enum: ['REGISTER', 'FORGOT_PASSWORD'], required: true },
  consumed: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('Otp', schema);
