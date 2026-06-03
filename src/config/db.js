import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

export const connectDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/rayanx_mdm';
    
    mongoose.connection.on('connected', () => logger.info('Database Pipeline Status: Connected to Cluster'));
    mongoose.connection.on('error', (err) => logger.error(`Database Pipeline Error: ${err.message}`));
    mongoose.connection.on('disconnected', () => logger.warn('Database Pipeline Status: Disconnected'));

    await mongoose.connect(mongoUri, { autoIndex: true });
  } catch (error) {
    logger.error(`Critical Database Connection Failure: ${error.message}`);
    process.exit(1);
  }
};
