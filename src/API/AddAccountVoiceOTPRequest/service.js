const { fields, fail } = require('../../utils/errors');
const { callProvider } = require('../../services/provider');
module.exports.AddAccountVoiceOTPRequest = async req => {
  const input = fields(req.query, ["otpCode", "econtact"]);
  const result = await callProvider('AddAccountVoiceOTPRequest', input, req.identity || null);
  if (typeof result.isSuccess !== 'boolean') fail(502, 'INVALID_PROVIDER_RESPONSE', 'Provider must return the legacy result envelope.');
  return result;
};
