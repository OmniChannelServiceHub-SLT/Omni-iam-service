const User = require('../../models/User');
const { createOtp } = require('../../utils/otp');
const { fields, fail } = require('../../utils/errors');

exports.RegisterV2 = async (req) => {
  const { userName } = fields(req.body, ['userName']);

  // This implementation is for explicit local development testing.
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.OTP_DEV_MODE !== 'true'
  ) {
    fail(
      503,
      'REGISTRATION_NOT_CONFIGURED',
      'Local registration requires development OTP mode.'
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

  let user = await User.findOne({ userName });

  if (user && user.status !== 'PENDING_OTP') {
    fail(
      409,
      'REGISTRATION_NOT_ALLOWED',
      'Registration is not available for this account.'
    );
  }

  if (!user) {
    try {
      user = await User.create({
        userName,
        passwordHash: null,
        userType: 'MOBILE',
        roles: ['CUSTOMER'],
        status: 'PENDING_OTP',
        tokenVersion: 0,
        failedLoginAttempts: 0
      });
    } catch (error) {
      if (error.code === 11000) {
        fail(
          409,
          'REGISTRATION_CONFLICT',
          'Registration already exists. Please retry.'
        );
      }

      throw error;
    }
  }

  const otp = await createOtp(user.userName, 'REGISTER');

  // Local convention: dataBundle identifies the OTP challenge.
  return {
    isSuccess: true,
    errorMessege: 'User Created & Updated with OTP',
    exceptionDetail: null,
    dataBundle: String(otp._id),
    errorShow: 'User Created & Updated with OTP',
    errorCode: 'E005'
  };
};