const { Sequelize } = require('sequelize');
const config = require('./index');
const path = require('path');
const fs = require('fs');

const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: config.db.path,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
});

module.exports = sequelize;
