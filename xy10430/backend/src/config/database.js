const { Sequelize, Op } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

module.exports = sequelize;
module.exports.Op = Op;
module.exports.Sequelize = Sequelize;
