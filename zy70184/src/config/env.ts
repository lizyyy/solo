import { config } from 'dotenv';

config();

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (value !== undefined) return value;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Environment variable ${key} is not set`);
};

export const env = {
  port: parseInt(getEnvVar('PORT', '3000'), 10),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  databaseUrl: getEnvVar('DATABASE_URL'),
  apiVersion: getEnvVar('API_VERSION', 'v1'),
};

export const isProduction = env.nodeEnv === 'production';
export const isDevelopment = env.nodeEnv === 'development';
