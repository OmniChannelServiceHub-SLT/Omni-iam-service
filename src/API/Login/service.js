const bcrypt = require('bcryptjs');

const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');

const { fields, fail } = require('../../utils/errors');

const {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshExpiryDate
} = require('../../utils/jwt');

exports.Login = async (req) => {
  const { Username, Password } = fields(
    req.body,
    ['Username', 'Password']
  );

  // Optional metadata from the Excel request.
  const metadataFields = [
    'fiebaseId',
    'appVersion',
    'osType'
  ];

  for (const key of metadataFields) {
    const value = req.body[key];

    if (
      value !== undefined &&
      (typeof value !== 'string' || value.length > 4096)
    ) {
      fail(
        400,
        'INVALID_INPUT',
        `${key} must be a string.`
      );
    }
  }

  const user = await User.findOne({
    userName: Username
  });

  if (!user || !user.passwordHash) {
    fail(
      401,
      'INVALID_CREDENTIALS',
      'Invalid username or password.'
    );
  }

  const passwordMatches = await bcrypt.compare(
    Password,
    user.passwordHash
  );

  if (!passwordMatches) {
    fail(
      401,
      'INVALID_CREDENTIALS',
      'Invalid username or password.'
    );
  }

  if (user.status !== 'ACTIVE') {
    fail(
      403,
      'ACCOUNT_INACTIVE',
      'Account is not active.'
    );
  }

  user.lastLoginAt = new Date();
  user.failedLoginAttempts = 0;

  if (req.body.fiebaseId !== undefined) {
    user.firebaseId = req.body.fiebaseId;
  }

  if (req.body.appVersion !== undefined) {
    user.appVersion = req.body.appVersion;
  }

  if (req.body.osType !== undefined) {
    user.osType = req.body.osType;
  }

  await user.save();

  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    tokenVersion: user.tokenVersion || 0,
    expiresAt: refreshExpiryDate(),
    revoked: false
  });

  // Bare response, as shown in Excel.
  return {
    accessToken,
    refreshToken,
    user_id: null,
    name: null
  };
};