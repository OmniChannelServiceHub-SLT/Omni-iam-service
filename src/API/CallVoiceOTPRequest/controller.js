const service = require('./service');

exports.CallVoiceOTPRequest = async (req, res) => {
  const result = await service.CallVoiceOTPRequest(req);
  return res.status(200).json(result);
};