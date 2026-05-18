const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database/test-drive-accident.db',
  logging: false
});

module.exports = sequelize;
