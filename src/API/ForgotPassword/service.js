const iam = require('../../services/iam');

exports.ForgotPassword = (req) => iam.ForgotPassword(req);