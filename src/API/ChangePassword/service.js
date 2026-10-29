const bcrypt = require('bcryptjs');

const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const Otp = require('../../models/Otp');

const { fields, fail } = require('../../utils/errors');
const { withTransaction } = require('../../utils/transaction');

exports.ChangePassword = async (req) => {
  const input = fields(req.body, [
    'UserName',
    'Password',
    'NewPassword'
  ]);

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

  // A user can change only their own password.
  if (user.userName !== input.UserName) {
    fail(
      403,
      'FORBIDDEN',
      'You can only change your own password.'
    );
  }

  if (!user.passwordHash) {
    fail(
      400,
      'PASSWORD_NOT_CONFIGURED',
      'Password login is not configured for this user.'
    );
  }

  const passwordMatches = await bcrypt.compare(
    input.Password,
    user.passwordHash
  );

  if (!passwordMatches) {
    fail(
      400,
      'INVALID_PASSWORD',
      'Current password is incorrect.'
    );
  }

  // Local password policy; adjust to the agreed project policy.
  if (
    input.NewPassword.length < 6 ||
    Buffer.byteLength(input.NewPassword, 'utf8') > 72
  ) {
    fail(
      400,
      'INVALID_NEW_PASSWORD',
      'New password must have at least 6 characters and not exceed 72 UTF-8 bytes.'
    );
  }

  const samePassword = await bcrypt.compare(
    input.NewPassword,
    user.passwordHash
  );

  if (samePassword) {
    fail(
      400,
      'PASSWORD_UNCHANGED',
      'New password must differ from the current password.'
    );
  }

  const newPasswordHash = await bcrypt.hash(
    input.NewPassword,
    12
  );

  // Prevent a concurrent request from overwriting a newer password.
  const updated = await withTransaction(async (session) => {
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        status: 'ACTIVE',
        passwordHash: user.passwordHash
      },
      {
        $set: { passwordHash: newPasswordHash },
        $inc: { tokenVersion: 1, authRevision: 1 }
      },
      { new: true, session }
    );
    if (!updatedUser) return false;

    await RefreshToken.updateMany({ user: user._id, revoked: false }, { $set: { revoked: true } }, { session });
    await Otp.updateMany({ userName: user.userName, consumed: false }, { $set: { consumed: true } }, { session });
    return true;
  });
  if (!updated) fail(409, 'PASSWORD_CHANGE_CONFLICT', 'Account changed during this request. Please log in again.');

  return {
    isSuccess: true,
    errorMessege: 'Password Changed Succesfully',
    exceptionDetail: null,
    dataBundle: null,
    errorShow: 'Password Changed Succesfully',
    errorCode: ''
  };
};