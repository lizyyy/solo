module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  database: {
    filename: './data/warehouse.db'
  },
  forklift: {
    minSafeBattery: 20,
    maxBattery: 100,
    chargingRatePerMinute: 2,
    consumptionPerHour: 15
  },
  shift: {
    nightShiftStart: '20:00',
    nightShiftEnd: '06:00',
    maxTasksPerForklift: 5
  },
  security: {
    sensitiveFields: ['operatorPhone', 'operatorIdCard', 'maintainerContact'],
    maskFields: true,
    maskPattern: '****'
  },
  logging: {
    level: 'info',
    filename: './logs/app.log',
    maxFiles: 5,
    maxSize: '10m'
  }
};