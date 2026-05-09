const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './data/audit.db',
  logging: false,
  define: {
    timestamps: true,
    paranoid: true
  }
});

module.exports = sequelize;
