const router = require('express').Router();

const identify = require('../../middleware/identify.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.post(
  '/TerminateProfile',
  identify,
  asyncHandler(controller.TerminateProfile)
);

module.exports = router;