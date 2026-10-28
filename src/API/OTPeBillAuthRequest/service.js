const crypto = require('crypto');

const User = require('../../models/User');
const Otp = require('../../models/Otp');
const { fields, fail } = require('../../utils/errors');
const { claimLatestOtp } = require('../../utils/otp');
const { withTransaction } = require('../../utils/transaction');

exports.OTPeBillAuthRequest = async (req) => {
  const input = fields(req.query, ['econtact', 'otpCode']);

  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.OTP_DEV_MODE !== 'true'
  ) {
    fail(
      503,
      'EBILL_OTP_NOT_CONFIGURED',
      'This implementation supports local eBill OTP testing only.'
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

  const scope = {
    user: user._id,
    userName: user.userName,
    tokenVersion: user.tokenVersion || 0,
    purpose: 'WORKFLOW_OTP',
    requestType: 'eBill',
    otpSource: 'MOBILE',
    otpContact: input.econtact
  };

  const verified = await withTransaction(async (session) => {
    const matches = await Otp.countDocuments({
      ...scope,
      consumed: false,
      attempts: { $lt: 5 },
      expiresAt: { $gt: new Date() }
    }).session(session);
    if (matches !== 1) return false;
    const challenge = await Otp.findOne(scope).sort({ createdAt: -1, _id: -1 }).session(session);
    if (!challenge || challenge.consumed || challenge.attempts >= 5 || challenge.expiresAt.getTime() <= Date.now()) return false;

    const lockScope = { telephoneNo: challenge.telephoneNo, requestType: 'eBill', otpSource: 'MOBILE', otpContact: challenge.otpContact };
    if (!(await claimLatestOtp({ userName: user.userName, purpose: 'WORKFLOW_OTP', scope: lockScope, id: challenge._id, session }))) return false;

    const expectedHash = crypto.createHmac('sha256', secret).update(JSON.stringify([
      String(challenge._id), String(user._id), challenge.purpose, challenge.tokenVersion,
      challenge.telephoneNo, challenge.requestType, challenge.otpSource, challenge.otpContact, input.otpCode
    ])).digest('hex');
    const usable = { ...scope, _id: challenge._id, consumed: false, attempts: { $lt: 5 }, expiresAt: { $gt: new Date() } };
    const consumed = await Otp.findOneAndUpdate(
      { ...usable, codeHash: expectedHash },
      { $set: { consumed: true, verifiedAt: new Date() } },
      { new: true, session }
    );
    if (consumed) return true;
    await Otp.updateOne(usable, { $inc: { attempts: 1 } }, { session });
    return false;
  });
  if (!verified) fail(400, 'OTP_INVALID', 'OTP is invalid, expired, used or locked.');

  return {
    isSuccess: true,
    errorMessege: null,
    exceptionDetail: null,
    dataBundle: null,
    errorShow: null,
    errorCode: null
  };
};