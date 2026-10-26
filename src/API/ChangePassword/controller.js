const service = require('./service');

exports.ChangePassword = async (req, res) => {
  const result = await service.ChangePassword(req);

  return res.status(200).json(result);
};