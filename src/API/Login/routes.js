const router = require('express').Router();

const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.post(
  '/Login',
  asyncHandler(controller.Login)
);

// Existing login URL compatibility.
router.post(
  '/auth/login',
  asyncHandler(controller.Login)
);

module.exports = router;