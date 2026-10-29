const router = require('express').Router();

const identify = require('../../middleware/identify.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.put(
  '/ChangeBBPassword',
  identify,
  asyncHandler(controller.ChangeBBPassword)
);

module.exports = router;