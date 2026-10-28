const service = require('./service');

exports.RegisterForBBFreedom = async (req, res) => {
  const result = await service.RegisterForBBFreedom(req);
  return res.status(200).json(result);
};