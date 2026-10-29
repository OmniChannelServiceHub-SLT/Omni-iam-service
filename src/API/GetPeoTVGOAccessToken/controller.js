

const service = require('./service');

exports.GetPeoTVGOAccessToken = async (req, res) => {
  const result = await service.GetPeoTVGOAccessToken(req);

  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');

  return res.status(200).json(result);
};