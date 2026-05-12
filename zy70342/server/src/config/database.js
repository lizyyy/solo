const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../data/import-platform.sqlite'),
  logging: false,
});

module.exports = sequelize;
