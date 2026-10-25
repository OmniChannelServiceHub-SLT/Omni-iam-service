const mongoose = require('mongoose');

function isVoiceOtp() {
  return this.purpose === 'ADD_ACCOUNT_VOICE';
}

const otpSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
      index: true
    },

    codeHash: {
      type: String,
      required: true
    },

    purpose: {
      type: String,
      enum: [
        'REGISTER',
        'FORGOT_PASSWORD',
        'ADD_ACCOUNT_VOICE'
      ],
      required: true
    },

    consumed: {
      type: Boolean,
      default: false
    },

    attempts: {
      type: Number,
      default: 0
    },

    expiresAt: {
      type: Date,
      required: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: isVoiceOtp
    },

    econtact: {
      type: String,
      required: isVoiceOtp
    },

    tokenVersion: {
      type: Number,
      required: isVoiceOtp
    },

    resultData: {
      type: String,
      required: isVoiceOtp
    },

    verifiedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

otpSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

module.exports = mongoose.model('Otp', otpSchema);