const router = require('express').Router();

const identify = require('../../middleware/identify.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.post(
  '/AddAccountVoiceOTPRequest',
  identify,
  asyncHandler(controller.AddAccountVoiceOTPRequest)
);

module.exports = router;