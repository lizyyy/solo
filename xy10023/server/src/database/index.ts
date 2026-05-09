import { Sequelize } from 'sequelize';
import { config } from '../config';
import logger from '../utils/logger';

const sequelize = new Sequelize(
  config.database.database,
  config.database.username,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: 'postgres',
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: config.database.ssl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
  }
);

export const testConnection = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};

export { sequelize };
export default sequelize;
