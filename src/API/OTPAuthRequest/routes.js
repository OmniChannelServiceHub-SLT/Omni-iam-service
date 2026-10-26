const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.post(
  '/OTPAuthRequest',
  asyncHandler(controller.OTPAuthRequest)
);

module.exports = router;