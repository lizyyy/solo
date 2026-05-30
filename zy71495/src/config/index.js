const path = require('path');

const config = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0'
  },
  database: {
    path: path.join(__dirname, '../../data/rental.db'),
    journalMode: 'WAL'
  },
  reports: {
    outputDir: path.join(__dirname, '../../reports'),
    dateFormat: 'YYYYMMDD'
  },
  rental: {
    defaultHourlyRate: 50,
    depositRate: 0.3,
    taxRate: 0.06
  },
  states: {
    rental: ['DRAFT', 'CONFIRMED', 'IN_USE', 'RETURNED', 'SETTLED', 'CLOSED', 'CANCELLED'],
    equipment: ['AVAILABLE', 'RENTED', 'DAMAGED', 'IN_REPAIR', 'RETIRED'],
    deposit: ['COLLECTED', 'PARTIAL_REFUNDED', 'REFUNDED', 'DEDUCTED']
  },
  batch: {
    prefix: 'BATCH',
    separator: '-'
  }
};

module.exports = config;
