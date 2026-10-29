const { fields, fail } = require('../../utils/errors');
const { callProvider } = require('../../services/provider');

exports.GetPeoTVGOAccessToken = async (req) => {
  const input = fields(req.query, [
    'grant_type',
    'code',
    'client_id',
    'client_secret'
  ]);

  if (input.grant_type !== 'authorization_code') {
    fail(
      400,
      'UNSUPPORTED_GRANT_TYPE',
      'grant_type must be authorization_code.'
    );
  }

  // The provider adapter must validate the client credentials,
  // authorization code, expiry and one-time code redemption.
  const result = await callProvider(
    'GetPeoTVGOAccessToken',
    input,
    null
  );

  const nonEmptyString = (value) =>
    typeof value === 'string' &&
    value.trim().length > 0;

  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    !nonEmptyString(result.access_token) ||
    !nonEmptyString(result.refresh_token) ||
    typeof result.token_type !== 'string' ||
    result.token_type.toLowerCase() !== 'bearer' ||
    !Number.isSafeInteger(result.expires_in) ||
    result.expires_in <= 0
  ) {
    fail(
      502,
      'INVALID_PROVIDER_RESPONSE',
      'PEO TV GO provider returned an invalid token response.'
    );
  }

  return {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    token_type: 'bearer',
    expires_in: result.expires_in
  };
};