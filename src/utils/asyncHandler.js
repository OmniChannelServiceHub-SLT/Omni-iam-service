// src/utils/asyncHandler.js
// Wraps an async Express handler so rejected promises reach error.middleware.js
// instead of crashing the process / hanging the request.
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
