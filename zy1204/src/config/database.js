const { Sequelize } = require('sequelize');
const path = require('path');

const env = process.env.NODE_ENV || 'development';
const dbPath = process.env.DB_PATH || './data/app.db';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.resolve(dbPath),
  logging: env === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: true
  }
});

module.exports = sequelize;
