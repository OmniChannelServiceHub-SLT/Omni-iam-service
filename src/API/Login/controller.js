const service = require('./service');

exports.Login = async (req, res) => {
  const result = await service.Login(req);

  return res.status(200).json(result);
};