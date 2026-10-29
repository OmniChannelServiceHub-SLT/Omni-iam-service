const service = require('./service');

exports.GetGoogleAccessToken = async (req, res) => {
  const result = await service.GetGoogleAccessToken(req);
  return res.status(200).json(result);
};