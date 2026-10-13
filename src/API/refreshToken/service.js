const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const { fields, fail } = require('../../utils/errors');

const {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshExpiryDate,
  accessExpiresInSeconds
} = require('../../utils/jwt');

exports.refreshToken = async (req) => {
  const input = fields(req.body, ['UserName', 'refreshToken']);

  const user = await User.findOne({
    userName: input.UserName,
    status: 'ACTIVE'
  });

  if (!user) {
    fail(
      401,
      'INVALID_REFRESH_TOKEN',
      'Invalid or expired refresh token.'
    );
  }

  const tokenVersion = user.tokenVersion || 0;
  const now = new Date();

  // Consume the supplied refresh token only once.
  const previousToken = await RefreshToken.findOneAndUpdate(
    {
      user: user._id,
      tokenHash: hashToken(input.refreshToken),
      tokenVersion,
      revoked: false,
      expiresAt: { $gt: now }
    },
    {
      $set: { revoked: true }
    },
    {
      new: true
    }
  );

  if (!previousToken) {
    fail(
      401,
      'INVALID_REFRESH_TOKEN',
      'Invalid or expired refresh token.'
    );
  }

  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();
  const expiresIn = accessExpiresInSeconds();

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    tokenVersion,
    revoked: false,
    expiresAt: refreshExpiryDate()
  });

  return {
    userName: user.userName,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: String(expiresIn),
    '.issued': now.toUTCString(),
    '.expires': new Date(
      now.getTime() + expiresIn * 1000
    ).toUTCString()
  };
};