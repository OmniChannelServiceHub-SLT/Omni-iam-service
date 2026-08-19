// Row #7 in Omni-Channel-API-Mapping-By-Service.xlsx ("Identity and
// Access Management" sheet).
// Legacy source: [Account] "Refresh" (POST)
// Proposed TMF-Aligned Method Name: createRefresh
const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const identify = require('../../middleware/identify.middleware');
const ctrl = require('./controller');

const router = express.Router();

router.post('/auth/refresh', asyncHandler(ctrl.createRefresh));

module.exports = router;
