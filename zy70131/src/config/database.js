const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.NODE_ENV === 'test' 
    ? ':memory:' 
    : './data/copyright.db',
  logging: false
});

module.exports = sequelize;
