const service = require('./service');

exports.VerifyOTPRequest = async (req, res) => {
  const result = await service.VerifyOTPRequest(req);

  return res.status(200).json(result);
};