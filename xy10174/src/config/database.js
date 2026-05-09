const path = require('path');

const env = process.env.NODE_ENV || 'development';

const configs = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, '../../data/dev.sqlite3')
    },
    useNullAsDefault: true
  },
  test: {
    client: 'sqlite3',
    connection: {
      filename: ':memory:'
    },
    useNullAsDefault: true
  }
};

module.exports = configs[env];
