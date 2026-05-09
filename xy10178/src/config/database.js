const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.NODE_ENV === 'test' 
    ? ':memory:' 
    : './claim_allocation.db',
  logging: process.env.NODE_ENV !== 'test' ? console.log : false
});

module.exports = sequelize;
