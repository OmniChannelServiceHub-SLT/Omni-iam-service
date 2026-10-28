const crypto = require('crypto');

const Otp = require('../../models/Otp');
const User = require('../../models/User');

const { fields, fail } = require('../../utils/errors');
const { envelope } = require('../../utils/response');
const { claimLatestOtp } = require('../../utils/otp');
const { withTransaction } = require('../../utils/transaction');

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

  const scope = {
    user: user._id,
    userName: user.userName,
    econtact,
    purpose: PURPOSE,
    tokenVersion
  };

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
  const verifiedOtp = await withTransaction(async (session) => {
    const otp = await Otp.findOne(scope).sort({ createdAt: -1, _id: -1 }).session(session);
    if (!otp || otp.consumed || otp.attempts >= 5 || otp.expiresAt.getTime() <= Date.now()) return null;
    if (typeof otp.resultData !== 'string' || !otp.resultData.trim()) return { invalidData: true };
    if (!(await claimLatestOtp({ userName: user.userName, purpose: PURPOSE, scope: { econtact }, id: otp._id, session }))) return null;

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
    const usable = { ...scope, _id: otp._id, consumed: false, attempts: { $lt: 5 }, expiresAt: { $gt: new Date() } };
    const consumed = await Otp.findOneAndUpdate(
      { ...usable, codeHash: submittedHash },
      { $set: { consumed: true, verifiedAt: new Date() } },
      { new: true, session }
    );
    if (consumed) return consumed;
    await Otp.updateOne(usable, { $inc: { attempts: 1 } }, { session });
    return null;
  });

  if (!verifiedOtp) {
    fail(
      400,
      'OTP_INVALID',
      'OTP is invalid, expired, used or locked.'
    );
  }
  if (verifiedOtp.invalidData) {
    fail(500, 'OTP_DATA_MISSING', 'The OTP request has no associated result data.');
  }

  return envelope({
    isSuccess: true,
    message: null,
    dataBundle: verifiedOtp.resultData,
    errorCode: null
  });
};