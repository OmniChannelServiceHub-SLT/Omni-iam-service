// src/utils/jwt.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

if (!ACCESS_SECRET) {
  throw new Error(
    'JWT_ACCESS_SECRET is not set. It must be identical to the API Gateway\'s JWT_ACCESS_SECRET.'
  );
}

/**
 * Signs the access token the Gateway's auth.middleware.js will verify.
 * Gateway reads decoded.sub, decoded.roles, decoded.scope - keep this shape.
 */
function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      userName: user.userName,
      roles: user.roles || ['CUSTOMER'],
      scope: 'iam:self',
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/** Opaque, unguessable refresh token. Only its hash is ever persisted. */
function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshExpiryDate() {
  const ms = parseDurationMs(REFRESH_EXPIRES_IN);
  return new Date(Date.now() + ms);
}

function accessExpiresInSeconds() {
  return Math.floor(parseDurationMs(ACCESS_EXPIRES_IN) / 1000);
}

function parseDurationMs(str) {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(String(str).trim());
  if (!match) return 15 * 60 * 1000; // fallback: 15 minutes
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * unitMs[unit];
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  refreshExpiryDate,
  accessExpiresInSeconds,
};
