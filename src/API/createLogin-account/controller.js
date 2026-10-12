const service = require('./service');
exports.Login = async (req, res) => res.status(200).json(await service.Login(req));
