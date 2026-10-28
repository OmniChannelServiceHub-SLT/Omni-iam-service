const router = require('express').Router();
const identify = require('../../middleware/identify.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

const handler = asyncHandler(controller.CallVoiceOTPRequest);

router.post(['/CallVoiceOTPRequest', '/AccountOMNI/CallVoiceOTPRequest'], identify, handler);

module.exports = router;