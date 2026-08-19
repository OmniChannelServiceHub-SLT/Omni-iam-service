// src/utils/response.js
// Reproduces the legacy SLT OMNI response envelope used by every endpoint
// in the params sheet except Login/Refresh/LoginExternal (which return a
// bare OAuth-style token object instead - see tokenPayload()).
//
// {
//   "isSuccess": true|false,
//   "errorMessege": "human readable message",   // (sic - matches legacy spelling)
//   "exceptionDetail": null|string,
//   "dataBundle": null|string|object,
//   "errorShow": "same as errorMessege",
//   "errorCode": null|string
// }

function envelope({ isSuccess, message = '', dataBundle = null, errorCode = null, exceptionDetail = null }) {
  return {
    isSuccess,
    errorMessege: message,
    exceptionDetail,
    dataBundle,
    errorShow: message,
    errorCode,
  };
}

function success(res, { message = '', dataBundle = null, errorCode = null, status = 200 } = {}) {
  return res.status(status).json(envelope({ isSuccess: true, message, dataBundle, errorCode }));
}

function failure(res, { message = 'Request failed.', errorCode = 'E000', exceptionDetail = null, status = 400 } = {}) {
  return res.status(status).json(
    envelope({ isSuccess: false, message, dataBundle: null, errorCode, exceptionDetail })
  );
}

module.exports = { envelope, success, failure };
