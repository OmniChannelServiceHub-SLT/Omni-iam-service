const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./controller');

router.post(['/LoginExternal', '/Account/LoginExternal'], asyncHandler(controller.LoginExternal));

module.exports = router;