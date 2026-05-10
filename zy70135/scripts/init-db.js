require('dotenv').config();
const db = require('../src/models');
const logger = require('../src/utils/logger');

async function initDatabase() {
  try {
    logger.info('Starting database initialization...');

    await db.sequelize.authenticate();
    logger.info('Database connection established');

    await db.sequelize.sync({ force: false });
    logger.info('Database tables created');

    logger.info('Database initialization completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database initialization failed:', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

initDatabase();
