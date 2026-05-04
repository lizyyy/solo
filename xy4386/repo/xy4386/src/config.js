const path = require('path');

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: 'localhost'
  },

  risk: {
    oxygen: {
      recoveryThreshold: 20.5,
      minAcceptableValue: 19.5,
      recoveryTimeWindow: 24
    },
    temperature: {
      min: 14,
      max: 24
    },
    humidity: {
      min: 40,
      max: 60
    }
  },

  data: {
    dataDir: path.join(__dirname, '..', 'data'),
    exportsDir: path.join(__dirname, '..', 'exports')
  },

  personnel: {
    validQualifications: ['档案管理员', '高级档案管理员', '库房管理员', '调阅人员']
  }
};
