const { unavailable } = require('../../utils/providerUnavailable');
const { fail } = require('../../utils/errors');

exports.GetGoogleAccessToken = async (req) => {
  if (req.baseUrl === '/api') {
    fail(404, 'ROUTE_NOT_FOUND', 'No legacy GetGoogleAccessToken route is defined.');
  }
  unavailable('GOOGLE_TOKEN_EXCHANGE_NOT_CONFIGURED', 'The Gateway GET-with-body compatibility flow and Google code redemption are not configured.');
};