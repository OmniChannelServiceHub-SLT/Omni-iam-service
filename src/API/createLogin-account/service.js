// Row #23 in Omni-Channel-API-Mapping-By-Service.xlsx ("Identity and
// Access Management" sheet).
// Legacy source: [Account] "Login" (POST)
// Proposed TMF-Aligned Method Name: createLogin
//
// NOTE (from the mapping sheet's own "Duplicate Group" column - a separate
// signal from the TMF-name collision used to disambiguate this folder name):
// flagged "DUPLICATE (Report)", duplicate group 'Group 14'. Other
// rows the sheet groups with this one: #24 [Account] LoginOIDCV2; #27 [Account] AuthonticationChatBotV2.
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const { signAccessToken, generateRefreshToken, hashToken, refreshExpiryDate } = require('../../utils/jwt');

async function issueTokenPair(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();
  await RefreshToken.create({ user: user._id, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiryDate() });
  return { accessToken, refreshToken };
}

async function createLogin(req) {
  const { Username: userName, Password: password, fiebaseId, appVersion, osType } = req.body;

  if (!userName || !password) {
    const err = new Error('Username and Password are required.');
    err.status = 400; err.code = 'E400';
    throw err;
  }

  const user = await User.findOne({ userName });
  if (!user || !user.passwordHash) {
    const err = new Error('Invalid credentials.');
    err.status = 401; err.code = 'E401';
    throw err;
  }

  if (user.status === 'TERMINATED') {
    const err = new Error('This account has been terminated.');
    err.status = 403; err.code = 'E403';
    throw err;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    user.failedLoginAttempts += 1;
    await user.save();
    const err = new Error('Invalid credentials.');
    err.status = 401; err.code = 'E401';
    throw err;
  }

  if (user.status === 'PENDING_OTP') {
    const err = new Error('OTP verification is required before login.');
    err.status = 403; err.code = 'E010';
    throw err;
  }

  user.failedLoginAttempts = 0;
  user.lastLoginAt = new Date();
  if (fiebaseId != null) user.firebaseId = String(fiebaseId);
  if (appVersion != null) user.appVersion = String(appVersion);
  if (osType) user.osType = osType;
  await user.save();

  const tokens = await issueTokenPair(user);

  // Legacy contract: bare token object, no envelope.
  return { bare: true, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user_id: String(user._id), name: user.name };
}

module.exports = { createLogin };
