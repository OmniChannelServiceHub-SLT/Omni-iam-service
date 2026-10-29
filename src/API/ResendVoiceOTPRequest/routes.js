const router = require('express').Router();
const identify = require('../../middleware/identify.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

const handler = asyncHandler(controller.ResendVoiceOTPRequest);

router.post(['/ResendVoiceOTPRequest', '/AccountOMNI/ResendVoiceOTPRequest'], identify, handler);

module.exports = router;