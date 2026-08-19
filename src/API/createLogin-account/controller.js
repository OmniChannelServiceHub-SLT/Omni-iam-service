// Row #23 in Omni-Channel-API-Mapping-By-Service.xlsx ("Identity and
// Access Management" sheet).
// Legacy source: [Account] "Login" (POST)
// Proposed TMF-Aligned Method Name: createLogin
//
// NOTE (from the mapping sheet's own "Duplicate Group" column - a separate
// signal from the TMF-name collision used to disambiguate this folder name):
// flagged "DUPLICATE (Report)", duplicate group 'Group 14'. Other
// rows the sheet groups with this one: #24 [Account] LoginOIDCV2; #27 [Account] AuthonticationChatBotV2.
const { success, failure } = require('../../utils/response');
const service = require('./service');

async function createLogin(req, res) {
  try {
    const result = await service.createLogin(req);
    if (result && result.bare) {
      // Legacy contract: bare token object, no envelope.
      const { bare, ...payload } = result;
      return res.status(200).json(payload);
    }
    return success(res, {
      message: (result && result.message) || 'createLogin OK',
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

module.exports = { createLogin };
