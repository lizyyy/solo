require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || './data/database.sqlite'
  }
};
