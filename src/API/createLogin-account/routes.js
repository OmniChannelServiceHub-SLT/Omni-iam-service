// Source IDs: A02. Paths are relative to /api or /internal-api/iam/v4.
const router = require('express').Router();
const identify = require('../../middleware/identify.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const ctrl = require('./controller');
router.post('/Account/Login', asyncHandler(ctrl.Login));
router.post('/auth/login', asyncHandler(ctrl.Login));
module.exports = router;
