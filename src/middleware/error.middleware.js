const { failure } = require('../utils/response');
module.exports = function errorHandler(err, req, res, next) {
  const status = err.code === 11000 ? 409 : err.name === 'CastError' ? 400 : err.status || 500;
  return failure(res, { status, errorCode: err.code === 11000 ? 'CONFLICT' : String(err.code || 'REQUEST_FAILED'), message: err.publicMessage || (status < 500 ? 'Invalid request.' : 'An unexpected error occurred.') });
};
