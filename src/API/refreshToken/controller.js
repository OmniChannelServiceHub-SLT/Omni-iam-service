const service = require('./service');

exports.refreshToken = async (req, res) => {
  const result = await service.refreshToken(req);
  return res.status(200).json(result);
};