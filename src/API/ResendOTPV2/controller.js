const service = require('./service');

exports.ResendOTPV2 = async (req, res) => {
  const result = await service.ResendOTPV2(req);

  return res.status(200).json(result);
};