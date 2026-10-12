const service = require('./service');
exports.refreshToken = async (req, res) => res.status(200).json(await service.refreshToken(req));
