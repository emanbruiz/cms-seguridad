import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from './logger.js';

mongoose.set('sanitizeFilter', true);

export async function connectDB() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  logger.info('MongoDB conectado');
}

export async function disconnectDB() {
  await mongoose.disconnect();
}