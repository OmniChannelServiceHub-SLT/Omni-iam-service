// Row #7 in Omni-Channel-API-Mapping-By-Service.xlsx ("Identity and
// Access Management" sheet).
// Legacy source: [Account] "Refresh" (POST)
// Proposed TMF-Aligned Method Name: createRefresh
const RefreshToken = require('../../models/RefreshToken');
const { signAccessToken, generateRefreshToken, hashToken, refreshExpiryDate, accessExpiresInSeconds } = require('../../utils/jwt');

async function issueTokenPair(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();
  await RefreshToken.create({ user: user._id, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiryDate() });
  return { accessToken, refreshToken };
}

async function createRefresh(req) {
  const { UserName: userName, refreshToken } = req.body;
  if (!userName || !refreshToken) {
    const err = new Error('UserName and refreshToken are required.'); err.status = 400; err.code = 'E400'; throw err;
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await RefreshToken.findOne({ tokenHash }).populate('user');

  if (!stored || stored.revoked || stored.expiresAt.getTime() < Date.now()) {
    const err = new Error('Refresh token is invalid or expired.'); err.status = 401; err.code = 'E401'; throw err;
  }
  if (!stored.user || stored.user.userName !== userName || stored.user.status !== 'ACTIVE') {
    const err = new Error('Refresh token is invalid or expired.'); err.status = 401; err.code = 'E401'; throw err;
  }

  stored.revoked = true;
  await stored.save();

  const tokens = await issueTokenPair(stored.user);
  const now = new Date();

  return {
    bare: true,
    userName: stored.user.userName,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: 'bearer',
    expires_in: String(accessExpiresInSeconds()),
    '.issued': now.toUTCString(),
    '.expires': new Date(now.getTime() + accessExpiresInSeconds() * 1000).toUTCString(),
  };
}

module.exports = { createRefresh };
