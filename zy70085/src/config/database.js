const { Sequelize } = require('sequelize');
const path = require('path');

const env = process.env.NODE_ENV || 'development';

let sequelize;

if (env === 'test') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
    retry: {
      max: 3
    }
  });
} else {
  const dbName = 'road_approval';
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, `../data/${dbName}.sqlite`),
    logging: console.log,
    retry: {
      max: 3
    }
  });
}

module.exports = sequelize;
