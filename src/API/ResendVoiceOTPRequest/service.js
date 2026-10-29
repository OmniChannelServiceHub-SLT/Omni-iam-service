const { unavailable } = require('../../utils/providerUnavailable');

exports.ResendVoiceOTPRequest = async (req) => {
  unavailable('VOICE_OTP_NOT_CONFIGURED', 'Voice OTP resend is not configured.');
};