const path = require('path');

module.exports = {
  port: process.env.PORT || 8080,
  dbPath: path.join(__dirname, '../../data/inspection.db'),
  limits: {
    maxPackageSize: '10mb',
    maxReadingsPerPackage: 1000
  },
  temperatureRange: {
    min: -10,
    max: 80
  },
  pressureRange: {
    min: 0,
    max: 10
  }
};
