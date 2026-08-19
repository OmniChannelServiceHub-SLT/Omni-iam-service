// Row #23 in Omni-Channel-API-Mapping-By-Service.xlsx ("Identity and
// Access Management" sheet).
// Legacy source: [Account] "Login" (POST)
// Proposed TMF-Aligned Method Name: createLogin
//
// NOTE (from the mapping sheet's own "Duplicate Group" column - a separate
// signal from the TMF-name collision used to disambiguate this folder name):
// flagged "DUPLICATE (Report)", duplicate group 'Group 14'. Other
// rows the sheet groups with this one: #24 [Account] LoginOIDCV2; #27 [Account] AuthonticationChatBotV2.
const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const identify = require('../../middleware/identify.middleware');
const ctrl = require('./controller');

const router = express.Router();

router.post('/auth/login', asyncHandler(ctrl.createLogin));

module.exports = router;
