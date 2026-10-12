const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const { fail } = require('../utils/errors');
module.exports = async function identify(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) fail(401, 'UNAUTHORIZED', 'Missing bearer token.');
    let decoded;
    try { decoded = verifyAccessToken(header.slice(7).trim()); }
    catch (_) { fail(401, 'UNAUTHORIZED', 'Invalid or expired token.'); }
    const user = await User.findById(decoded.sub);
    if (!user || user.status !== 'ACTIVE' || decoded.ver !== (user.tokenVersion || 0)) fail(401, 'UNAUTHORIZED', 'Session revoked or account inactive.');
    req.identity = { userId: String(user._id), userName: user.userName, roles: user.roles };
    next();
  } catch (e) { next(e); }
};
