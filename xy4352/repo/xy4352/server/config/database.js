const { Sequelize } = require('sequelize');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/water-quality.db');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
  define: {
    timestamps: true,
    underscored: true,
  }
});

module.exports = sequelize;
