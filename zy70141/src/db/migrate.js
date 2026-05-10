require('dotenv').config();
const { sequelize, connect } = require('./index');
const { setupAssociations } = require('../models');
const logger = require('../utils/logger');

async function migrate() {
  try {
    logger.info('Starting database migration...');
    
    await connect();
    
    setupAssociations();
    
    const forceSync = process.env.FORCE_SYNC === 'true';
    
    await sequelize.sync({ 
      force: forceSync,
      alter: !forceSync,
    });
    
    logger.info('Database migration completed successfully');
    
    if (forceSync) {
      logger.warn('Database has been force-synced, all data cleared');
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Database migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;
