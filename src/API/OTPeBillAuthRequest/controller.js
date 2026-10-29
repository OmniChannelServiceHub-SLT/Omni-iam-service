const service = require('./service');

exports.OTPeBillAuthRequest = async (req, res) => {
  const result = await service.OTPeBillAuthRequest(req);

  return res.status(200).json(result);
};