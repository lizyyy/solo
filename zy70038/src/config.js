const path = require('path');

const config = {
  defaultHoldTime: 2 * 60 * 60 * 1000,
  maxHoldTime: 24 * 60 * 60 * 1000,
  checkInterval: 60 * 1000,
  pickupCodeLength: 6,
  dataDir: path.join(process.cwd(), 'data'),
  exportDir: path.join(process.cwd(), 'exports'),
  stores: {
    '001': { name: '北京朝阳店', timezone: 'Asia/Shanghai' },
    '002': { name: '上海浦东店', timezone: 'Asia/Shanghai' },
    '003': { name: '广州天河店', timezone: 'Asia/Shanghai' }
  }
};

module.exports = config;
