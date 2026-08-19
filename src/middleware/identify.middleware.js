// src/middleware/identify.middleware.js
//
// Requests normally arrive here already authenticated by the Gateway's
// auth.middleware.js, which verifies the JWT and forwards trusted
// x-user-id / x-user-roles / x-user-scope headers (client-supplied copies
// of those headers are stripped by the Gateway before proxying).
//
// This middleware also independently verifies the JWT itself using
// JWT_ACCESS_SECRET (same value as the Gateway) as defense-in-depth and so
// this service still works correctly if it's ever called directly
// (local testing, service-to-service calls that bypass the Gateway, etc).
const { verifyAccessToken } = require('../utils/jwt');
const { failure } = require('../utils/response');

module.exports = function identify(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      req.identity = {
        userId: decoded.sub,
        userName: decoded.userName,
        roles: decoded.roles || [],
      };
      return next();
    } catch (err) {
      return failure(res, {
        message: 'Token is invalid or expired.',
        errorCode: 'E401',
        status: 401,
      });
    }
  }

  // Fallback: trust the Gateway-set headers if no bearer token was
  // presented directly to this service (i.e. request came via the Gateway,
  // which already validated the JWT and stripped any client-forged copies
  // of these headers before proxying).
  const gatewayUserId = req.headers['x-user-id'];
  if (gatewayUserId) {
    req.identity = {
      userId: gatewayUserId,
      userName: null,
      roles: (req.headers['x-user-roles'] || '').split(',').filter(Boolean),
    };
    return next();
  }

  return failure(res, {
    message: 'Missing bearer token.',
    errorCode: 'E401',
    status: 401,
  });
};
