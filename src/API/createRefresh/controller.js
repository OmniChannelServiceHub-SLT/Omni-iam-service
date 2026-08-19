// Row #7 in Omni-Channel-API-Mapping-By-Service.xlsx ("Identity and
// Access Management" sheet).
// Legacy source: [Account] "Refresh" (POST)
// Proposed TMF-Aligned Method Name: createRefresh
const { success, failure } = require('../../utils/response');
const service = require('./service');

async function createRefresh(req, res) {
  try {
    const result = await service.createRefresh(req);
    if (result && result.bare) {
      // Legacy contract: bare token object, no envelope.
      const { bare, ...payload } = result;
      return res.status(200).json(payload);
    }
    return success(res, {
      message: (result && result.message) || 'createRefresh OK',
      dataBundle: (result && result.dataBundle) !== undefined ? result.dataBundle : (result || null),
      errorCode: (result && result.errorCode) !== undefined ? result.errorCode : null,
    });
  } catch (err) {
    return failure(res, {
      message: err.message,
      errorCode: err.code || 'E500',
      status: err.status || 500,
    });
  }
}

module.exports = { createRefresh };
