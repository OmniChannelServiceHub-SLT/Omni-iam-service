// src/models/Otp.js
// Mirrors the legacy contract: on Register / Resend OTP / Forgot Password,
// dataBundle returns the Mongo _id of this OTP record. The client then sends
// { verifyOtp, id } back to the verify/forgot-password endpoints.
const mongoose = require('mongoose');

const { Schema } = mongoose;

const OTP_PURPOSES = ['REGISTER', 'FORGOT_PASSWORD'];

const otpSchema = new Schema(
  {
    userName: { type: String, required: true, index: true },
    code: { type: String, required: true },
    purpose: { type: String, enum: OTP_PURPOSES, required: true },
    consumed: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Otp', otpSchema);
module.exports.OTP_PURPOSES = OTP_PURPOSES;
