const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.post(['/ForgotPassword', '/Account/ForgotPassword'], asyncHandler(controller.ForgotPassword));

module.exports = router;