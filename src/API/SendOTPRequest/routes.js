const router = require('express').Router();

const identify = require('../../middleware/identify.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.get(
  '/SendOTPRequest',
  identify,
  asyncHandler(controller.SendOTPRequest)
);

module.exports = router; 