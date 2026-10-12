const service = require('./service');
exports.AddAccountVoiceOTPRequest = async (req, res) => res.status(200).json(await service.AddAccountVoiceOTPRequest(req));
