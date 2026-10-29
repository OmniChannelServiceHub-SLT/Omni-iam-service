const router = require('express').Router();
const identify = require('../../middleware/identify.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

const handler = asyncHandler(controller.RegisterForBBFreedom);

router.post(['/RegisterForBBFreedom', '/BBExternal/RegisterForBBFreedom'], identify, handler);

module.exports = router;