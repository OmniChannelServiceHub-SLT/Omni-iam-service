// src/middleware/error.middleware.js
const { failure } = require('../utils/response');

module.exports = function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // eslint-disable-next-line no-console
  console.error('[IAM]', err.stack || err.message);

  return failure(res, {
    message: err.publicMessage || 'An unexpected error occurred.',
    errorCode: err.code || 'E500',
    exceptionDetail: process.env.NODE_ENV === 'production' ? null : err.message,
    status: err.status || 500,
  });
};
