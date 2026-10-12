require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
(async () => {
  if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_TEST_SEED !== 'true') throw new Error('Set NODE_ENV=development and ALLOW_TEST_SEED=true for local test seeding only.');
  if (!process.env.TEST_USER_NAME || !process.env.TEST_USER_PASSWORD || process.env.TEST_USER_PASSWORD.length < 6 || Buffer.byteLength(process.env.TEST_USER_PASSWORD) > 72) throw new Error('Set TEST_USER_NAME and TEST_USER_PASSWORD (6+ characters, <=72 bytes).');
  await mongoose.connect(process.env.MONGODB_URI);
  if (await User.exists({ userName: process.env.TEST_USER_NAME })) throw new Error('User exists; seeding does not overwrite accounts.');
  await User.create({ userName: process.env.TEST_USER_NAME, passwordHash: await bcrypt.hash(process.env.TEST_USER_PASSWORD, 12), status: 'ACTIVE' });
  console.log('Local test user created. Disable ALLOW_TEST_SEED after use.');
})().catch(e => { console.error(e.message); process.exitCode=1; }).finally(() => mongoose.disconnect());
