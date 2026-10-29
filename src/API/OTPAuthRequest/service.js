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
const { withTransaction } = require('../../utils/transaction');

exports.OTPAuthRequest = async (req) => {
  const input = fields(req.body, ['verifyOtp', 'id']);

  if (!/^[a-fA-F0-9]{24}$/.test(input.id)) {
    fail(400, 'OTP_INVALID', 'Invalid OTP request.');
  }

  const challengeId = new mongoose.Types.ObjectId(input.id);
  let result;
  try {
    result = await withTransaction(async (session) => {
    const challenge = await Otp.findOne({ _id: challengeId, purpose: 'REGISTER' }).session(session);
    if (!challenge) return { invalid: true };

    const pendingUser = await User.findOne({ userName: challenge.userName, status: 'PENDING_OTP' }).session(session);
    if (!pendingUser) return { unavailable: true };

    const verified = await verifyOtp({
      id: input.id,
      userName: challenge.userName,
      code: input.verifyOtp,
      purpose: 'REGISTER',
      session,
      returnInvalid: true
    });
    if (!verified) return { invalid: true };

    const user = await User.findOneAndUpdate(
      { _id: pendingUser._id, status: 'PENDING_OTP' },
      { $set: { status: 'ACTIVE', lastLoginAt: new Date(), failedLoginAttempts: 0 }, $inc: { authRevision: 1 } },
      { new: true, runValidators: true, session }
    );
    if (!user) throw Object.assign(new Error('Registration changed during verification.'), { code: 'REGISTRATION_CHANGED' });

    const accessToken = signAccessToken(user);
    const refreshToken = generateRefreshToken();
    await RefreshToken.create([{
      user: user._id,
      tokenHash: hashToken(refreshToken),
      tokenVersion: user.tokenVersion || 0,
      revoked: false,
      expiresAt: refreshExpiryDate()
    }], { session });
    return { accessToken, refreshToken };
    });
  } catch (error) {
    if (error.code !== 'REGISTRATION_CHANGED') throw error;
    fail(409, 'REGISTRATION_CHANGED', 'Registration changed during verification.');
  }

  if (result.invalid) fail(400, 'OTP_INVALID', 'OTP is invalid, expired, used or locked.');
  if (result.unavailable) fail(400, 'REGISTRATION_NOT_PENDING', 'No pending registration is available.');

  return {
    isSuccess: true,
    errorMessege: 'OTP Verified',
    exceptionDetail: null,
    dataBundle: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user_id: null,
      name: null
    },
    errorShow: 'OTP Verified',
    errorCode: null
  };
};