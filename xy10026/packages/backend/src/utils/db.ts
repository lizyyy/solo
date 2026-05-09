import mongoose from 'mongoose';
import config from '../config';
import logger from './logger';

class Database {
  private connection: mongoose.Connection | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('Database already connected');
      return;
    }

    try {
      const mongoUri = `${config.mongodb.uri}/${config.mongodb.database}`;
      
      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.connection = mongoose.connection;
      this.isConnected = true;

      logger.info('MongoDB connected successfully', { uri: config.mongodb.uri, database: config.mongodb.database });

      this.connection.on('error', (err) => {
        logger.error('MongoDB connection error', err);
        this.isConnected = false;
      });

      this.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      this.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
      });

    } catch (error) {
      logger.error('Failed to connect to MongoDB', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.connection) {
      return;
    }

    await mongoose.disconnect();
    this.isConnected = false;
    logger.info('MongoDB disconnected');
  }

  getConnection(): mongoose.Connection | null {
    return this.connection;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }
}

export default new Database();
