const { fail } = require('../utils/errors');
// A server-controlled adapter URL. Never derive URLs from request parameters.
async function callProvider(operation, input, identity = null) {
  const url = process.env[`IAM_PROVIDER_${operation.toUpperCase()}_URL`];
  if (!url) fail(503, 'PROVIDER_NOT_CONFIGURED', `Configure IAM_PROVIDER_${operation.toUpperCase()}_URL for ${operation}.`);
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))
    fail(503, 'PROVIDER_CONFIG_INVALID', 'Provider URL must use HTTPS.');
  if (!process.env.IAM_PROVIDER_API_KEY) fail(503, 'PROVIDER_NOT_CONFIGURED', 'Configure IAM_PROVIDER_API_KEY.');
  let response;
  try {
    response = await fetch(url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.IAM_PROVIDER_API_KEY}` },
      body: JSON.stringify({ operation, input, identity })
    });
  } catch (_) { fail(502, 'PROVIDER_UNAVAILABLE', 'Provider adapter could not be reached.'); }
  if (!response.ok) fail(502, 'PROVIDER_REJECTED', 'Provider adapter rejected the request.');
  let payload;
  try { payload = await response.json(); } catch (_) { fail(502, 'INVALID_PROVIDER_RESPONSE', 'Provider must return JSON.'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail(502, 'INVALID_PROVIDER_RESPONSE', 'Provider must return an object.');
  return payload;
}
module.exports = { callProvider };
