const { unavailable } = require('../../utils/providerUnavailable');

exports.RegisterForBBFreedom = async (req) => {
  unavailable('BROADBAND_REGISTRATION_NOT_CONFIGURED', 'Broadband account lookup and registration semantics are not configured.');
};