const service = require('./service');

exports.OTPAuthRequest = async (req, res) => {
  const result = await service.OTPAuthRequest(req);

  return res.status(200).json(result);
};