const crypto = require('crypto');

const Otp = require('../../models/Otp');
const User = require('../../models/User');

const { fields, fail } = require('../../utils/errors');
const { envelope } = require('../../utils/response');

const PURPOSE = 'ADD_ACCOUNT_VOICE';

exports.AddAccountVoiceOTPRequest = async (req) => {
  // Excel specifies query parameters.
  const { otpCode, econtact } = fields(
    req.query,
    ['otpCode', 'econtact']
  );

  if (!req.identity?.userId) {
    fail(
      401,
      'UNAUTHORIZED',
      'Missing authenticated identity.'
    );
  }

  const user = await User.findById(req.identity.userId);

  if (!user || user.status !== 'ACTIVE') {
    fail(
      401,
      'UNAUTHORIZED',
      'Account is inactive.'
    );
  }

  const tokenVersion = user.tokenVersion || 0;

  // Select the latest challenge for this user/contact.
  const otp = await Otp.findOne({
    user: user._id,
    userName: user.userName,
    econtact,
    purpose: PURPOSE,
    tokenVersion
  }).sort({
    createdAt: -1,
    _id: -1
  });

  if (
    !otp ||
    otp.consumed ||
    otp.attempts >= 5 ||
    otp.expiresAt.getTime() <= Date.now()
  ) {
    fail(
      400,
      'OTP_INVALID',
      'OTP is invalid, expired, used or locked.'
    );
  }

  if (
    typeof otp.resultData !== 'string' ||
    !otp.resultData.trim()
  ) {
    fail(
      500,
      'OTP_DATA_MISSING',
      'The OTP request has no associated result data.'
    );
  }

  const secret =
    process.env.OTP_HASH_SECRET ||
    process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    fail(
      503,
      'OTP_SECRET_NOT_CONFIGURED',
      'OTP hashing secret is not configured.'
    );
  }

  // Matches the existing utils/otp.js hash format.
  const submittedHash = crypto
    .createHmac('sha256', secret)
    .update(
      JSON.stringify([
        otp.userName,
        PURPOSE,
        String(otpCode)
      ])
    )
    .digest('hex');

  const filter = {
    _id: otp._id,
    user: user._id,
    userName: user.userName,
    econtact,
    purpose: PURPOSE,
    tokenVersion,
    consumed: false,
    attempts: {
      $lt: 5
    },
    expiresAt: {
      $gt: new Date()
    }
  };

  // Only one request can successfully consume this OTP.
  const verifiedOtp = await Otp.findOneAndUpdate(
    {
      ...filter,
      codeHash: submittedHash
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

  if (!verifiedOtp) {
    await Otp.updateOne(
      filter,
      {
        $inc: {
          attempts: 1
        }
      }
    );

    fail(
      400,
      'OTP_INVALID',
      'OTP is invalid, expired, used or locked.'
    );
  }

  return envelope({
    isSuccess: true,
    message: null,
    dataBundle: verifiedOtp.resultData,
    errorCode: null
  });
};