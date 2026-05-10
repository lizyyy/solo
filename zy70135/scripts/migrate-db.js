require('dotenv').config();
const db = require('../src/models');
const logger = require('../src/utils/logger');

async function migrateDatabase() {
  try {
    logger.info('Starting database migration...');

    await db.sequelize.authenticate();
    logger.info('Database connection established');

    await db.sequelize.sync({ alter: true });
    logger.info('Database migration completed');

    process.exit(0);
  } catch (error) {
    logger.error('Database migration failed:', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

migrateDatabase();
