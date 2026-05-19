const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  db: {
    path: path.join(__dirname, '../../data/database.sqlite')
  },
  encryption: {
    secretKey: process.env.ENCRYPTION_KEY || 'agri-coop-2024-secret-key'
  },
  logging: {
    level: 'info',
    dir: path.join(__dirname, '../../logs')
  },
  uploads: {
    dir: path.join(__dirname, '../../uploads')
  },
  exports: {
    dir: path.join(__dirname, '../../exports')
  },
  billing: {
    hourlyRate: 80,
    acreRate: 50,
    fuelRate: 7.5,
    baseServiceFee: 20
  }
};
