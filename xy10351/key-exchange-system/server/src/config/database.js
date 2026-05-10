const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './data/key_exchange.db',
  logging: false,
});

module.exports = sequelize;
