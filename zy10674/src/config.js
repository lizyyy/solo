const DEFAULT_PORT = 3000;
const DEFAULT_HOST = 'localhost';

function getConfig() {
  const config = {
    port: parseInt(process.env.PORT || DEFAULT_PORT, 10),
    host: process.env.HOST || DEFAULT_HOST,
    env: process.env.NODE_ENV || 'development'
  };

  const missing = [];
  if (isNaN(config.port)) missing.push('PORT 必须是有效的端口号');

  return { config, missing };
}

function validateConfig() {
  const { config, missing } = getConfig();
  if (missing.length > 0) {
    console.warn('\n⚠️  配置警告:');
    missing.forEach(m => console.warn(`   - ${m}`));
    console.warn('   使用默认配置继续...\n');
  }
  return config;
}

function printStartupInfo(config) {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 工单SLA服务暂停计时证明服务');
  console.log('='.repeat(50));
  console.log(`📍 服务地址: http://${config.host}:${config.port}`);
  console.log(`🌍 运行环境: ${config.env}`);
  console.log(`📦 数据存储: 内存存储 (不依赖外部服务)`);
  console.log('\n📋 可用接口:');
  console.log('   GET  /api/health          - 健康检查');
  console.log('   GET  /api/constants       - 常量定义');
  console.log('   POST /api/tickets         - 创建工单');
  console.log('   GET  /api/tickets         - 工单列表');
  console.log('   GET  /api/tickets/:id     - 工单详情');
  console.log('   GET  /api/tickets/:id/history - 工单历史');
  console.log('   POST /api/tickets/pause   - 暂停计时');
  console.log('   POST /api/tickets/resume  - 恢复计时');
  console.log('   GET  /api/export          - 导出数据');
  console.log('   POST /api/import          - 导入数据');
  console.log('   POST /api/check-timeout   - 超时检查');
  console.log('='.repeat(50) + '\n');
}

module.exports = {
  getConfig,
  validateConfig,
  printStartupInfo
};
