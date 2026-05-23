const path = require('path');

module.exports = {
  dbPath: path.join(__dirname, '..', 'data', 'car-wash.db'),
  journalMode: 'WAL',
  foreignKeys: true
};
