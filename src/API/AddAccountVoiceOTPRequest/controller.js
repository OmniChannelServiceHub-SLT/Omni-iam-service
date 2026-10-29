const service = require('./service');

exports.AddAccountVoiceOTPRequest = async (req, res) => {
  const result = await service.AddAccountVoiceOTPRequest(req);

  return res.status(200).json(result);
};
