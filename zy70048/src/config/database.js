const { Sequelize } = require('sequelize');
const config = require('./config');
const logger = require('../utils/logger');

const sequelize = new Sequelize({
  dialect: config.db.dialect,
  storage: config.db.storage,
  logging: config.nodeEnv === 'development' 
    ? (msg) => logger.debug(msg) 
    : false
});

module.exports = sequelize;
