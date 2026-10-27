const crypto = require('crypto');

const User = require('../../models/User');
const Otp = require('../../models/Otp');
const { fields, fail } = require('../../utils/errors');

exports.VerifyOTPRequest = async (req) => {
  const input = fields(req.query, [
    'telephoneNo',
    'requestType',
    'otpCode',
    'otpSource'
  ]);

  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.OTP_DEV_MODE !== 'true'
  ) {
    fail(
      503,
      'OTP_WORKFLOW_NOT_CONFIGURED',
      'This workflow currently supports local OTP testing only.'
    );
  }

  const secret =
    process.env.OTP_HASH_SECRET ||
    process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    fail(
      503,
      'OTP_NOT_CONFIGURED',
      'OTP hashing secret is not configured.'
    );
  }

  if (!req.identity?.userId) {
    fail(401, 'UNAUTHORIZED', 'Authentication is required.');
  }

  const user = await User.findOne({
    _id: req.identity.userId,
    status: 'ACTIVE'
  });

  if (!user) {
    fail(401, 'UNAUTHORIZED', 'Active user not found.');
  }

  if (
    input.requestType !== 'eBill' ||
    input.otpSource !== 'MOBILE'
  ) {
    fail(
      400,
      'UNSUPPORTED_OTP_WORKFLOW',
      'Local testing supports requestType eBill and otpSource MOBILE.'
    );
  }

  const scope = {
    user: user._id,
    userName: user.userName,
    purpose: 'WORKFLOW_OTP',
    tokenVersion: user.tokenVersion || 0,
    telephoneNo: input.telephoneNo,
    requestType: input.requestType,
    otpSource: input.otpSource
  };

  // Select the latest challenge, including consumed/locked records.
  // Never fall back to an older usable challenge.
  const challenge = await Otp.findOne(scope).sort({
    createdAt: -1,
    _id: -1
  });

  if (
    !challenge ||
    challenge.consumed ||
    challenge.attempts >= 5 ||
    challenge.expiresAt.getTime() <= Date.now()
  ) {
    fail(
      400,
      'OTP_INVALID',
      'OTP is invalid, expired, used or locked.'
    );
  }

  // Must match the hash format used in SendOTPRequest.
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(
      JSON.stringify([
        String(challenge._id),
        String(user._id),
        challenge.purpose,
        challenge.tokenVersion,
        challenge.telephoneNo,
        challenge.requestType,
        challenge.otpSource,
        challenge.otpContact,
        input.otpCode
      ])
    )
    .digest('hex');

  const usableChallenge = {
    ...scope,
    _id: challenge._id,
    consumed: false,
    attempts: { $lt: 5 },
    expiresAt: { $gt: new Date() }
  };

  // Only one request can consume this OTP successfully.
  const verified = await Otp.findOneAndUpdate(
    {
      ...usableChallenge,
      codeHash: expectedHash
    },
    {
      $set: {
        consumed: true,
        verifiedAt: new Date()
      }
    },
    {
      new: true
    }
  );

  if (!verified) {
    await Otp.updateOne(
      {
        ...usableChallenge,
        expiresAt: { $gt: new Date() }
      },
      {
        $inc: { attempts: 1 }
      }
    );

    fail(
      400,
      'OTP_INVALID',
      'OTP is invalid, expired, used or locked.'
    );
  }

  return {
    isSuccess: true,
    errorMessege: null,
    exceptionDetail: null,
    dataBundle: null,
    errorShow: null,
    errorCode: null
  };
};