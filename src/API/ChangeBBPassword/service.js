const { fields, fail } = require('../../utils/errors');
const { callProvider } = require('../../services/provider');

exports.ChangeBBPassword = async (req) => {
  const input = fields(req.query, [
    'subscriberID',
    'currentpass',
    'newpass'
  ]);

  if (!req.identity?.userId) {
    fail(
      401,
      'UNAUTHORIZED',
      'Authentication is required.'
    );
  }

  // The adapter must authorize this user for the subscriber account
  // and perform the password change in the broadband backend.
  const result = await callProvider(
    'ChangeBBPassword',
    input,
    req.identity
  );

  const hasOwn = (key) =>
    Object.prototype.hasOwnProperty.call(result, key);

  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    typeof result.isSuccess !== 'boolean'
  ) {
    fail(
      502,
      'INVALID_PROVIDER_RESPONSE',
      'Broadband provider returned an invalid response.'
    );
  }

  const nullableString = (value) =>
    value === null || typeof value === 'string';

  const requiredFields = [
    'errorMessege',
    'exceptionDetail',
    'dataBundle',
    'errorShow',
    'errorCode'
  ];

  if (
    !requiredFields.every(hasOwn) ||
    !nullableString(result.errorMessege) ||
    !nullableString(result.errorShow) ||
    !nullableString(result.errorCode)
  ) {
    fail(
      502,
      'INVALID_PROVIDER_RESPONSE',
      'Broadband provider returned an invalid result envelope.'
    );
  }

  return {
    isSuccess: result.isSuccess,
    errorMessege: result.errorMessege,
    exceptionDetail: null,
    dataBundle: result.dataBundle,
    errorShow: result.errorShow,
    errorCode: result.errorCode
  };
};