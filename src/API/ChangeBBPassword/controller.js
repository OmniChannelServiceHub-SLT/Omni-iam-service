const service = require('./service');

exports.ChangeBBPassword = async (req, res) => {
  const result = await service.ChangeBBPassword(req);

  return res.status(200).json(result);
};