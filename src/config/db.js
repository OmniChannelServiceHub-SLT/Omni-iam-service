// src/config/db.js
const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not set.');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri);

  // eslint-disable-next-line no-console
  console.log(`IAM Service connected to MongoDB (${mongoose.connection.name})`);

  mongoose.connection.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection error:', err.message);
  });

  return mongoose.connection;
};
