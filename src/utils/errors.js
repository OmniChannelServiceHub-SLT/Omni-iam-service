function fail(status, code, message) { throw Object.assign(new Error(message), { status, code, publicMessage: message }); }
function fields(input, names) {
  const out = {};
  for (const name of names) {
    if (typeof input?.[name] !== 'string' || !input[name].trim() || input[name].length > 4096)
      fail(400, 'INVALID_INPUT', `${name} must be a non-empty string.`);
    out[name] = input[name];
  }
  return out;
}
module.exports = { fail, fields };
