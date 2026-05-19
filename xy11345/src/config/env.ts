import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || './data/qc_system.db',
  logLevel: process.env.LOG_LEVEL || 'info',
  adminApiKey: process.env.ADMIN_API_KEY || 'admin-qc-key-2024',
};
