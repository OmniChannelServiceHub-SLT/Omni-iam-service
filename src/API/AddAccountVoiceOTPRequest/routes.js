// Source IDs: A33. Paths are relative to /api or /internal-api/iam/v4.
const router = require('express').Router();
const identify = require('../../middleware/identify.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const ctrl = require('./controller');
router.post('/AccountOMNI/AddAccountVoiceOTPRequest', identify, asyncHandler(ctrl.AddAccountVoiceOTPRequest));
module.exports = router;
