const mongoose = require('mongoose');
const { fail } = require('./errors');

function transactionUnavailable(error) {
  return error?.code === 20 || error?.code === 303 ||
    /transaction numbers are only allowed|does not support transactions|transactions are not supported/i.test(error?.message || '');
}

async function withTransaction(work) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    }, {
      readPreference: 'primary',
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' }
    });
    return result;
  } catch (error) {
    if (transactionUnavailable(error)) {
      fail(503, 'TRANSACTIONS_REQUIRED', 'This operation requires MongoDB replica-set or sharded-cluster transaction support.');
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

module.exports = { withTransaction, transactionUnavailable };