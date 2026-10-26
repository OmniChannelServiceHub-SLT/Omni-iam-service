const service = require('./service');

exports.RegisterV2 = async (req, res) => {
  const result = await service.RegisterV2(req);

  return res.status(200).json(result);
};