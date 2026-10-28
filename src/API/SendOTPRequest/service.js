const crypto = require('crypto');

const User = require('../../models/User');
const Otp = require('../../models/Otp');
const { fields, fail } = require('../../utils/errors');
const { reserveOtpIssuance } = require('../../utils/otp');

exports.SendOTPRequest = async (req) => {
  const input = fields(req.query, [
    'telephoneNo',
    'requestType',
    'requestPeriod',
    'otpSource',
    'otpContact'
  ]);

  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.OTP_DEV_MODE !== 'true'
  ) {
    fail(
      503,
      'OTP_DELIVERY_NOT_CONFIGURED',
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

  if (!/^[1-9]\d{0,3}$/.test(input.requestPeriod)) {
    fail(
      400,
      'INVALID_INPUT',
      'requestPeriod must be a positive integer string of up to 4 digits.'
    );
  }

  const purpose = 'WORKFLOW_OTP';
  const tokenVersion = user.tokenVersion || 0;

  // Verification identifies the latest challenge using this scope.
  // Contact is stored on the challenge and is not supplied at verification.
  const scope = {
    user: user._id,
    userName: user.userName,
    purpose,
    tokenVersion,
    telephoneNo: input.telephoneNo,
    requestType: input.requestType,
    otpSource: input.otpSource
  };

  const otpId = new Otp()._id;
  const code = String(crypto.randomInt(100000, 1000000));
  await reserveOtpIssuance(user.userName, purpose, {
    telephoneNo: input.telephoneNo,
    requestType: input.requestType,
    otpSource: input.otpSource,
    otpContact: input.otpContact
  }, { challengeId: otpId });

  // Bind the code to this challenge, user, workflow and recipient.
  const codeHash = crypto
    .createHmac('sha256', secret)
    .update(
      JSON.stringify([
        String(otpId),
        String(user._id),
        purpose,
        tokenVersion,
        input.telephoneNo,
        input.requestType,
        input.otpSource,
        input.otpContact,
        code
      ])
    )
    .digest('hex');

  await Otp.updateMany(
    {
      ...scope,
      consumed: false
    },
    {
      $set: { consumed: true }
    }
  );

  await Otp.create({
    _id: otpId,
    ...scope,
    requestPeriod: input.requestPeriod,
    otpContact: input.otpContact,
    codeHash,
    consumed: false,
    attempts: 0,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000)
  });

  console.log(
    `[LOCAL WORKFLOW OTP ONLY] id=${otpId} purpose=${purpose} code=${code}`
  );

  return {
    isSuccess: true,
    errorMessege: 'OTP sent successfully.',
    exceptionDetail: null,
    dataBundle: null,
    errorShow: 'OTP sent successfully.',
    errorCode: null
  };
};