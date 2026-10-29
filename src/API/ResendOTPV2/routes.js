const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.post(
  '/ResendOTPV2',
  asyncHandler(controller.ResendOTPV2)
);

module.exports = router;