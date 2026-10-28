const service = require('./service');

exports.ForgotPassword = async (req, res) => {
  const result = await service.ForgotPassword(req);
  return res.status(200).json(result);
};