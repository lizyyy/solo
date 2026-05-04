const path = require('path');

const config = {
  app: {
    name: 'RF频点预检工具',
    version: '1.0.0',
    port: process.env.PORT || 3000
  },
  db: {
    path: process.env.DB_PATH || path.join(__dirname, '../../data/rf-checker.json')
  },
  frequency: {
    minTolerance: 0.025,
    safeDistance: 1.0,
    bands: {
      uhfLow: { min: 470.0, max: 614.0, name: 'UHF低频段' },
      uhfMid: { min: 614.0, max: 698.0, name: 'UHF中频段' },
      uhfHigh: { min: 698.0, max: 960.0, name: 'UHF高频段' }
    }
  },
  intermod: {
    orders: [2, 3],
    tolerance: 0.05
  }
};

module.exports = config;
