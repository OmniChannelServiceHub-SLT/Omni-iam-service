const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const { fields, fail } = require('../../utils/errors');
const { withTransaction } = require('../../utils/transaction');

const {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshExpiryDate,
  accessExpiresInSeconds
} = require('../../utils/jwt');

function formatLegacyUtc(date) {
  const hour = date.getUTCHours();
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  const twoDigits = (value) => String(value).padStart(2, '0');
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()} ${displayHour}:${twoDigits(date.getUTCMinutes())}:${twoDigits(date.getUTCSeconds())} ${period} +00:00`;
}

exports.refreshToken = async (req) => {
  const input = fields(req.body, ['UserName', 'refreshToken']);
  let result;
  try {
    result = await withTransaction(async (session) => {
    const user = await User.findOne({ userName: input.UserName, status: 'ACTIVE' }).session(session);
    if (!user) return null;

    const tokenVersion = user.tokenVersion || 0;
    const now = new Date();
    const previousToken = await RefreshToken.findOneAndUpdate(
      {
        user: user._id,
        tokenHash: hashToken(input.refreshToken),
        tokenVersion,
        revoked: false,
        expiresAt: { $gt: now }
      },
      { $set: { revoked: true } },
      { new: true, session }
    );
    if (!previousToken) return null;

    const fencedUser = await User.findOneAndUpdate(
      { _id: user._id, status: 'ACTIVE', tokenVersion },
      { $inc: { authRevision: 1 } },
      { new: true, session }
    );
    if (!fencedUser) throw Object.assign(new Error('Refresh invalidated during rotation.'), { code: 'REFRESH_INVALIDATED' });

    const refreshToken = generateRefreshToken();
    const expiresIn = accessExpiresInSeconds();
    await RefreshToken.create([{
      user: user._id,
      tokenHash: hashToken(refreshToken),
      tokenVersion,
      revoked: false,
      expiresAt: refreshExpiryDate()
    }], { session });

    return {
      userName: user.userName,
      access_token: signAccessToken(fencedUser),
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: String(expiresIn),
      '.issued': formatLegacyUtc(now),
      '.expires': formatLegacyUtc(new Date(now.getTime() + expiresIn * 1000))
    };
    });
  } catch (error) {
    if (error.code !== 'REFRESH_INVALIDATED') throw error;
    result = null;
  }

  if (!result) fail(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
  return result;
};

exports.formatLegacyUtc = formatLegacyUtc;