const router = require('express').Router();

const identify = require('../../middleware/identify.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.post(
  '/OTPeBillAuthRequest',
  identify,
  asyncHandler(controller.OTPeBillAuthRequest)
);

module.exports = router;