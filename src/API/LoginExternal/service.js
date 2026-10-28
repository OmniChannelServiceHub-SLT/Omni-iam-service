const { fail } = require('../../utils/errors');

exports.LoginExternal = async (req) => {
  fail(
    503,
    'EXTERNAL_LOGIN_NOT_CONFIGURED',
    'Verified external identity providers are not configured.'
  );
};