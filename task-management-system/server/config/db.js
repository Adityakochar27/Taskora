const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');

  mongoose.set('strictQuery', true);

  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  logger.info(`MongoDB connected → ${conn.connection.host}/${conn.connection.name}`);

  mongoose.connection.on('disconnected', () =>
    logger.warn('MongoDB disconnected')
  );
  mongoose.connection.on('error', (err) => logger.error('MongoDB error', err));

  return conn;
};

module.exports = connectDB;
