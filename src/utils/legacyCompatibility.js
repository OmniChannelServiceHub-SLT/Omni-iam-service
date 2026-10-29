const { fail } = require('./errors');
module.exports.handleCompatibility = () => fail(501, 'LEGACY_HANDLER_REMOVED', 'Use the explicit IAM API modules; generated authentication responses are disabled.');
