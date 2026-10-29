const service = require('./service');

exports.SendOTPRequest = async (req, res) => {
  const result = await service.SendOTPRequest(req);

  return res.status(200).json(result);
};