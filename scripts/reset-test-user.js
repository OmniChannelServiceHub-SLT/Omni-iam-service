require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const password = 'Test@123';
  const passwordHash = await bcrypt.hash(
    password,
    Number(process.env.BCRYPT_SALT_ROUNDS || 10)
  );

  const user = await User.findOneAndUpdate(
    { userName: 'testuser' },
    {
      $set: {
        passwordHash,
        status: 'ACTIVE',
        failedLoginAttempts: 0
      }
    },
    { new: true }
  );

  if (!user) {
    throw new Error('testuser not found');
  }

  console.log('Test user updated successfully');
  console.log({
    userName: user.userName,
    status: user.status
  });

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});