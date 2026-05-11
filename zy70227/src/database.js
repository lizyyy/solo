const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './data/conference.db',
  logging: false
});

module.exports = sequelize;
