const mongoose = require('mongoose');

const User = require('../../models/User');
const Otp = require('../../models/Otp');
const RefreshToken = require('../../models/RefreshToken');

const { fields, fail } = require('../../utils/errors');
const { verifyOtp } = require('../../utils/otp');

const {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshExpiryDate
} = require('../../utils/jwt');

exports.OTPAuthRequest = async (req) => {
  const input = fields(req.body, ['verifyOtp', 'id']);

  if (!/^[a-fA-F0-9]{24}$/.test(input.id)) {
    fail(400, 'OTP_INVALID', 'Invalid OTP request.');
  }

  const challengeId = new mongoose.Types.ObjectId(input.id);

  const challenge = await Otp.findOne({
    _id: challengeId,
    purpose: 'REGISTER',
    consumed: false,
    attempts: { $lt: 5 },
    expiresAt: { $gt: new Date() }
  });

  if (!challenge) {
    fail(
      400,
      'OTP_INVALID',
      'OTP is invalid, expired, used or locked.'
    );
  }

  const pendingUser = await User.findOne({
    userName: challenge.userName,
    status: 'PENDING_OTP'
  });

  if (!pendingUser) {
    fail(
      400,
      'REGISTRATION_NOT_PENDING',
      'No pending registration is available.'
    );
  }

  // Checks the hash and atomically consumes a correct OTP.
  await verifyOtp({
    id: input.id,
    userName: challenge.userName,
    code: input.verifyOtp,
    purpose: 'REGISTER'
  });

  // Never reactivate a terminated account.
  const user = await User.findOneAndUpdate(
    {
      _id: pendingUser._id,
      status: 'PENDING_OTP'
    },
    {
      $set: {
        status: 'ACTIVE',
        lastLoginAt: new Date(),
        failedLoginAttempts: 0
      }
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!user) {
    fail(
      409,
      'REGISTRATION_CHANGED',
      'Registration changed during verification.'
    );
  }

  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    tokenVersion: user.tokenVersion || 0,
    revoked: false,
    expiresAt: refreshExpiryDate()
  });

  return {
    isSuccess: true,
    errorMessege: 'OTP Verified',
    exceptionDetail: null,
    dataBundle: {
      accessToken,
      refreshToken,
      user_id: null,
      name: null
    },
    errorShow: 'OTP Verified',
    errorCode: null
  };
};