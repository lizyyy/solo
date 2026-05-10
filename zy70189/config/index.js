const path = require('path');

module.exports = {
  server: {
    port: 3000,
    host: 'localhost'
  },
  
  database: {
    path: path.join(__dirname, '..', 'refund_permission.db')
  },
  
  log: {
    level: process.env.LOG_LEVEL || 'info',
    file: path.join(__dirname, '..', 'logs', 'app.log')
  },
  
  refund: {
    defaultMaxAmount: 1000,
    defaultCurrency: 'CNY'
  },
  
  permission: {
    levels: {
      junior: { name: '初级客服', canApprove: false, maxAmount: 0 },
      intermediate: { name: '中级客服', canApprove: false, maxAmount: 500 },
      senior: { name: '高级客服', canApprove: false, maxAmount: 2000 },
      supervisor: { name: '主管', canApprove: true, maxAmount: 5000 },
      manager: { name: '经理', canApprove: true, maxAmount: 10000 },
      director: { name: '总监', canApprove: true, maxAmount: null }
    }
  }
};
