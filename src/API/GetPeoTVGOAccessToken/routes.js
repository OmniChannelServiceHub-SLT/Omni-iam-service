const router = require('express').Router();

const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.get(
  '/GetPeoTVGOAccessToken',
  asyncHandler(controller.GetPeoTVGOAccessToken)
);

module.exports = router;