// src/models/User.js
const mongoose = require('mongoose');

const { Schema } = mongoose;

const USER_STATUS = ['PENDING_OTP', 'ACTIVE', 'TERMINATED'];

const userSchema = new Schema(
  {
    // "userName" in the legacy SLT contract is typically the mobile number.
    userName: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, default: null }, // null for pure external-login accounts
    name: { type: String, default: null },
    userType: { type: String, default: 'MOBILE' }, // MOBILE, Mobile, FTTH, etc (legacy values kept free-form)
    altrContact: { type: String, default: null },

    firebaseId: { type: String, default: null },
    appVersion: { type: String, default: null },
    osType: { type: String, default: null },

    // Populated only for LoginExternal (FB/Google/Apple) accounts.
    externalProvider: { type: String, default: null },
    externalAccessEmail: { type: String, default: null },

    roles: { type: [String], default: ['CUSTOMER'] },
    status: { type: String, enum: USER_STATUS, default: 'PENDING_OTP' },

    failedLoginAttempts: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
module.exports.USER_STATUS = USER_STATUS;
