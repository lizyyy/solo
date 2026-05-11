const { Sequelize } = require('sequelize');
const dbConfig = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env];

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    pool: config.pool || {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    logging: env === 'development' ? console.log : false,
  }
);

module.exports = sequelize;
