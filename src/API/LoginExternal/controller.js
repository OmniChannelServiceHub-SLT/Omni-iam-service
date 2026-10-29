const service = require('./service');

exports.LoginExternal = async (req, res) => {
  const result = await service.LoginExternal(req);
  return res.status(200).json(result);
};