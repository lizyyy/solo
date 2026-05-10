import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';

config();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'custom_clearance',
  entities: ['dist/entities/**/*.entity.js'],
  migrations: ['dist/migrations/**/*.js'],
  synchronize: process.env.DB_SYNC === 'true',
  logging: process.env.NODE_ENV === 'development',
};

export default new DataSource(dataSourceOptions);
