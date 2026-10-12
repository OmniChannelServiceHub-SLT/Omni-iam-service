// Source IDs: A05. Paths are relative to /api or /internal-api/iam/v4.
const router = require('express').Router();
const identify = require('../../middleware/identify.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const ctrl = require('./controller');
router.post('/Account/refreshToken', asyncHandler(ctrl.refreshToken));
router.post('/auth/refresh', asyncHandler(ctrl.refreshToken));
module.exports = router;
