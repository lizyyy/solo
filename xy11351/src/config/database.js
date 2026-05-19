const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../data/database.sqlite'),
  logging: false,
  define: {
    timestamps: true,
    freezeTableName: true
  },
  transactionType: 'IMMEDIATE'
});

module.exports = { sequelize };
