const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './water-valve.db',
  logging: false
});

module.exports = sequelize;