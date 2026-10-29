const { unavailable } = require('../../utils/providerUnavailable');

exports.CallVoiceOTPRequest = async (req) => {
  unavailable('VOICE_OTP_NOT_CONFIGURED', 'Authorized account lookup and voice OTP delivery are not configured.');
};