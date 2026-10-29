const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.get('/GetGoogleAccessToken', asyncHandler(controller.GetGoogleAccessToken));

module.exports = router;