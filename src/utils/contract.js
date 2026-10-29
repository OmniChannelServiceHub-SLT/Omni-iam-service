const schemas = require('../contracts/response-samples.json');
const { fail } = require('./errors');
function matches(schema, value) {
  if (schema.type === 'null') return value === null;
  if (schema.type === 'integer') return Number.isInteger(value);
  if (schema.type === 'array') return Array.isArray(value) && (!schema.items || value.every(v => matches(schema.items,v)));
  if (schema.type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value) && schema.required.every(k=>Object.hasOwn(value,k) && matches(schema.properties[k],value[k])) && Object.keys(value).every(k=>Object.hasOwn(schema.properties,k));
  return typeof value === schema.type;
}
function validateResponse(operation, result) {
  const schema = schemas[operation];
  if (!schema || !matches(schema,result)) fail(502,'INVALID_PROVIDER_RESPONSE','Provider result does not match the documented Excel response fields/types.');
}
module.exports = { validateResponse, matches };
