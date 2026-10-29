const router = require('express').Router();

const identify = require('../../middleware/identify.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.get(
  '/VerifyOTPRequest',
  identify,
  asyncHandler(controller.VerifyOTPRequest)
);

module.exports = router;