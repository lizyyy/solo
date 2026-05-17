const config = {
  port: process.env.PORT || 3000,
  dbPath: process.env.DB_PATH || './data/qualification.db',
  logLevel: process.env.LOG_LEVEL || 'info'
};

function validateConfig() {
  const missing = [];
  if (!config.port) missing.push('PORT');
  if (!config.dbPath) missing.push('DB_PATH');
  
  if (missing.length > 0) {
    console.error('缺少必要配置:', missing.join(', '));
    console.error('请设置环境变量或使用默认值');
    process.exit(1);
  }
}

module.exports = { config, validateConfig };
