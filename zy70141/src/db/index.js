const { Sequelize } = require('sequelize');
const config = require('../config');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  config.database.database,
  config.database.username,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: config.database.dialect,
    pool: config.database.pool,
    logging: config.server.env === 'development' 
      ? (msg) => logger.debug(msg) 
      : false,
  }
);

async function connect() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
}

async function disconnect() {
  await sequelize.close();
  logger.info('Database connection closed');
}

module.exports = {
  sequelize,
  Sequelize,
  connect,
  disconnect,
};
