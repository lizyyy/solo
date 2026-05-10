const config = require('../config');

function getTableType(partySize) {
  const types = Object.entries(config.TABLE_TYPES);
  for (const [type, config] of types) {
    if (partySize >= config.min && partySize <= config.max) {
      return type;
    }
  }
  return 'LARGE';
}

function calculateWaitingTime(position, averageTimePerTable = 15) {
  return position * averageTimePerTable;
}

function formatNumber(type, count) {
  const prefix = {
    SMALL: 'A',
    MEDIUM: 'B',
    LARGE: 'C'
  };
  return `${prefix[type] || 'N'}${String(count).padStart(3, '0')}`;
}

module.exports = {
  getTableType,
  calculateWaitingTime,
  formatNumber
};
