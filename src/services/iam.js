const bcrypt = require('bcryptjs');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const Otp = require('../models/Otp');
const jwt = require('../utils/jwt');
const { createOtp, verifyOtp } = require('../utils/otp');
const { fail, fields } = require('../utils/errors');
const { envelope } = require('../utils/response');
const ok = (message, dataBundle = null, errorCode = null) => envelope({ isSuccess: true, message, dataBundle, errorCode });
async function tokens(user) {
  const refreshToken = jwt.generateRefreshToken();
  await RefreshToken.create({ user: user._id, tokenHash: jwt.hashToken(refreshToken), expiresAt: jwt.refreshExpiryDate(), tokenVersion: user.tokenVersion || 0 });
  return { accessToken: jwt.signAccessToken(user), refreshToken, user_id: null, name: null };
}
function password(value) { if (value.length < 6 || Buffer.byteLength(value, 'utf8') > 72) fail(400, 'PASSWORD_POLICY', 'Use a password of at least 6 characters and at most 72 UTF-8 bytes.'); }
function owner(req, name) { if (req.identity.userName !== name) fail(403, 'FORBIDDEN', 'Only your own account may be changed.'); }
async function invalidate(user) {
  await RefreshToken.updateMany({ user: user._id, revoked: false }, { $set: { revoked: true } });
  await Otp.updateMany({ userName: user.userName, consumed: false }, { $set: { consumed: true } });
}
async function Login(req) {
  const { Username, Password } = fields(req.body, ['Username', 'Password']);
  const user = await User.findOne({ userName: Username });
  if (!user || !user.passwordHash || !(await bcrypt.compare(Password, user.passwordHash))) fail(401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
  if (user.status !== 'ACTIVE') fail(403, 'ACCOUNT_INACTIVE', 'Account is not active.');
  user.lastLoginAt = new Date();
  for (const [source, target] of [['fiebaseId','firebaseId'],['appVersion','appVersion'],['osType','osType']])
    if (typeof req.body[source] === 'string') user[target] = req.body[source];
  await user.save(); return tokens(user);
}
async function refreshToken(req) {
  const data = fields(req.body, ['UserName', 'refreshToken']);
  const user = await User.findOne({ userName: data.UserName, status: 'ACTIVE' });
  if (!user) fail(401, 'INVALID_REFRESH', 'Invalid refresh token.');
  // Atomic consume prevents two requests from rotating the same token.
  const record = await RefreshToken.findOneAndUpdate({ user: user._id, tokenHash: jwt.hashToken(data.refreshToken), revoked: false, expiresAt: { $gt: new Date() }, tokenVersion: user.tokenVersion || 0 }, { $set: { revoked: true } }, { new: true });
  if (!record) fail(401, 'INVALID_REFRESH', 'Invalid refresh token.');
  const pair = await tokens(user); const now = new Date();
  return { userName: user.userName, access_token: pair.accessToken, refresh_token: pair.refreshToken, token_type: 'bearer', expires_in: String(jwt.accessExpiresInSeconds()), '.issued': now.toUTCString(), '.expires': new Date(+now + jwt.accessExpiresInSeconds()*1000).toUTCString() };
}
async function RegisterV2(req) {
  const { userName } = fields(req.body, ['userName']);
  let user = await User.findOne({ userName });
  if (user && user.status !== 'PENDING_OTP') fail(409, 'ACCOUNT_EXISTS', 'Account already exists.');
  if (!user) user = await User.create({ userName, status: 'PENDING_OTP' });
  const otp = await createOtp(userName, 'REGISTER');
  return ok('User Created & Updated with OTP', String(otp._id), 'E005');
}
async function ResendOTPV2(req) {
  const { UserName } = fields(req.body, ['UserName']);
  const user = await User.findOne({ userName: UserName });
  if (!user || user.status === 'TERMINATED') fail(400, 'ACCOUNT_UNAVAILABLE', 'Account unavailable.');
  const otp = await createOtp(UserName, user.status === 'PENDING_OTP' ? 'REGISTER' : 'FORGOT_PASSWORD');
  return ok('OTP Sent', String(otp._id));
}
async function OTPAuthRequest(req) {
  const { id, verifyOtp: code } = fields(req.body, ['id', 'verifyOtp']);
  const record = await verifyOtp({ id, code, purpose: 'REGISTER' });
  const user = await User.findOneAndUpdate({ userName: record.userName, status: 'PENDING_OTP' }, { $set: { status: 'ACTIVE' } }, { new: true });
  if (!user) fail(400, 'ACCOUNT_UNAVAILABLE', 'Registration account unavailable.');
  return ok('OTP Verified', await tokens(user));
}
async function ChangePassword(req) {
  const data = fields(req.body, ['UserName', 'Password', 'NewPassword']); owner(req, data.UserName); password(data.NewPassword);
  const user = await User.findOne({ _id: req.identity.userId, status: 'ACTIVE' });
  if (!user || !user.passwordHash || !(await bcrypt.compare(data.Password, user.passwordHash))) fail(400, 'INVALID_PASSWORD', 'Current password is invalid.');
  const changed = await User.findOneAndUpdate({ _id: user._id, passwordHash: user.passwordHash, status: 'ACTIVE' }, { $set: { passwordHash: await bcrypt.hash(data.NewPassword, 12) }, $inc: { tokenVersion: 1 } }, { new: true });
  if (!changed) fail(409, 'ACCOUNT_CHANGED', 'Account changed; retry.');
  await invalidate(changed); return ok('Password Changed Succesfully', null, '');
}
async function ForgotPassword(req) {
  const data = fields(req.body, ['UserName','verifyOtp','newPassword']); password(data.newPassword);
  const user = await User.findOne({ userName: data.UserName, status: 'ACTIVE' });
  if (!user) fail(400, 'ACCOUNT_UNAVAILABLE', 'Account unavailable.');
  await verifyOtp({ userName: data.UserName, code: data.verifyOtp, purpose: 'FORGOT_PASSWORD' });
  const changed = await User.findOneAndUpdate({ _id: user._id, status: 'ACTIVE' }, { $set: { passwordHash: await bcrypt.hash(data.newPassword, 12) }, $inc: { tokenVersion: 1 } }, { new: true });
  if (!changed) fail(409, 'ACCOUNT_CHANGED', 'Account changed; retry.');
  await invalidate(changed); return ok('Password Updated', String(changed._id));
}
async function TerminateProfile(req) {
  const { userName } = fields(req.body, ['userName','userType']); owner(req, userName);
  const user = await User.findOneAndUpdate({ _id: req.identity.userId, status: 'ACTIVE' }, { $set: { status: 'TERMINATED' }, $inc: { tokenVersion: 1 } }, { new: true });
  if (!user) fail(409, 'ACCOUNT_UNAVAILABLE', 'Account unavailable.');
  await invalidate(user); return ok('User Terminated Succesfully', null, '');
}
module.exports = { Login, refreshToken, RegisterV2, ResendOTPV2, OTPAuthRequest, ChangePassword, ForgotPassword, TerminateProfile };
