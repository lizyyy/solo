const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './rental.db',
  logging: false
});

module.exports = sequelize;
