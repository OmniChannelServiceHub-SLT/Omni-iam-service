const router = require('express').Router();

const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.post(
  '/refreshToken',
  asyncHandler(controller.refreshToken)
);

router.post(
  '/auth/refresh',
  asyncHandler(controller.refreshToken)
);

module.exports = router;