const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const Otp = require('../../models/Otp');

const { fields, fail } = require('../../utils/errors');
const { withTransaction } = require('../../utils/transaction');

exports.TerminateProfile = async (req) => {
  const input = fields(req.body, ['userName', 'userType']);

  const userId = req.identity?.userId;

  if (!userId) {
    fail(
      401,
      'UNAUTHORIZED',
      'Authentication is required.'
    );
  }

  const user = await User.findOne({
    _id: userId,
    status: 'ACTIVE'
  });

  if (!user) {
    fail(
      401,
      'UNAUTHORIZED',
      'Active user not found.'
    );
  }

  // The authenticated user can terminate only their own account.
  if (user.userName !== input.userName) {
    fail(
      403,
      'FORBIDDEN',
      'You can only terminate your own profile.'
    );
  }

  // Accept the Excel value "Mobile" with the local model value "MOBILE".
  const requestedType = input.userType.trim().toUpperCase();
  const storedType = String(user.userType || '').trim().toUpperCase();

  if (requestedType !== storedType) {
    fail(
      400,
      'INVALID_USER_TYPE',
      'User type does not match this profile.'
    );
  }

  const terminated = await withTransaction(async (session) => {
    const terminatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        userName: user.userName,
        status: 'ACTIVE'
      },
      { $set: { status: 'TERMINATED' }, $inc: { tokenVersion: 1, authRevision: 1 } },
      { new: true, runValidators: true, session }
    );
    if (!terminatedUser) return false;

    await RefreshToken.updateMany({ user: user._id, revoked: false }, { $set: { revoked: true } }, { session });
    await Otp.updateMany({ userName: user.userName, consumed: false }, { $set: { consumed: true } }, { session });
    return true;
  });
  if (!terminated) fail(409, 'PROFILE_CHANGED', 'Profile changed during this request.');

  return {
    isSuccess: true,
    errorMessege: 'User Terminated Succesfully',
    exceptionDetail: null,
    dataBundle: null,
    errorShow: 'User Terminated Succesfully',
    errorCode: ''
  };
};