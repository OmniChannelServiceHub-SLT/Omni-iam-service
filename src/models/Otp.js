const mongoose = require('mongoose');

function isVoiceOtp() {
  return this.purpose === 'ADD_ACCOUNT_VOICE';
}

function isWorkflowOtp() {
  return this.purpose === 'WORKFLOW_OTP';
}

function isBoundOtp() {
  return isVoiceOtp.call(this) || isWorkflowOtp.call(this);
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
        'ADD_ACCOUNT_VOICE',
        'WORKFLOW_OTP'
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
      required: isBoundOtp
    },

    econtact: {
      type: String,
      required: isVoiceOtp
    },

    tokenVersion: {
      type: Number,
      required: isBoundOtp
    },

    resultData: {
      type: String,
      required: isVoiceOtp
    },

    telephoneNo: {
      type: String,
      required: isWorkflowOtp
    },

    requestType: {
      type: String,
      required: isWorkflowOtp
    },

    requestPeriod: {
      type: String,
      required: isWorkflowOtp
    },

    otpSource: {
      type: String,
      required: isWorkflowOtp
    },

    otpContact: {
      type: String,
      required: isWorkflowOtp
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