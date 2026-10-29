const User = require('../../models/User');

const { createOtp } = require('../../utils/otp');
const { fields, fail } = require('../../utils/errors');

exports.ResendOTPV2 = async (req) => {
  const input = fields(req.body, ['UserName', 'userType']);

  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.OTP_DEV_MODE !== 'true'
  ) {
    fail(
      503,
      'OTP_DELIVERY_NOT_CONFIGURED',
      'Local registration resend requires development OTP mode.'
    );
  }

  if (
    !process.env.OTP_HASH_SECRET &&
    !process.env.JWT_ACCESS_SECRET
  ) {
    fail(
      503,
      'OTP_NOT_CONFIGURED',
      'OTP hashing secret is not configured.'
    );
  }

  const user = await User.findOne({
    userName: input.UserName,
    status: 'PENDING_OTP'
  });

  if (!user) {
    fail(
      400,
      'REGISTRATION_NOT_PENDING',
      'No matching pending registration is available.'
    );
  }

  const requestedType = input.userType.trim().toUpperCase();
  const storedType = String(user.userType || '')
    .trim()
    .toUpperCase();

  if (requestedType !== storedType) {
    fail(
      400,
      'INVALID_USER_TYPE',
      'User type does not match the pending registration.'
    );
  }

  const otp = await createOtp(user.userName, 'REGISTER');

  return {
    isSuccess: true,
    errorMessege: 'OTP Sent',
    exceptionDetail: null,
    dataBundle: String(otp._id),
    errorShow: 'OTP Sent',
    errorCode: null
  };
};