const service = require('./service');

exports.ResendVoiceOTPRequest = async (req, res) => {
  const result = await service.ResendVoiceOTPRequest(req);
  return res.status(200).json(result);
};