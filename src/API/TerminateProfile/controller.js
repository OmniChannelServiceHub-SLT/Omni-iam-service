const service = require('./service');

exports.TerminateProfile = async (req, res) => {
  const result = await service.TerminateProfile(req);

  return res.status(200).json(result);
};