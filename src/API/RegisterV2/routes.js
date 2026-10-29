const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.post(
  '/RegisterV2',
  asyncHandler(controller.RegisterV2)
);

module.exports = router;