const { fail } = require('./errors');

function unavailable(code, message) {
  fail(503, code, message);
}

module.exports = { unavailable };