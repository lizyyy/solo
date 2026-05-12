const express = require('express');
const cors = require('cors');
const config = require('./config');
const { initSchema } = require('./database/schema');
const routes = require('./routes');
const { handleError } = require('./utils/errorHandler');
const logger = require('./utils/logger');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

initSchema();

app.get('/', (req, res) => {
  res.json({
    success: true,
    name: '客服机器人转人工 API',
    version: '1.0.0',
    description: '处理机器人会话转人工时的意图、情绪、排队优先级和处理结果',
    endpoints: {
      conversations: '/api/conversations',
      escalations: '/api/escalations',
      processing: '/api/processing',
      reports: '/api/reports',
      health: '/api/health'
    }
  });
});

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在'
    }
  });
});

app.use(handleError);

app.listen(config.PORT, () => {
  logger.info('客服机器人转人工 API 已启动', { port: config.PORT });
  console.log(`\n🚀 客服机器人转人工 API 已启动`);
  console.log(`📍 服务地址: http://localhost:${config.PORT}`);
  console.log(`📖 API 说明:`);
  console.log(`   - 健康检查: http://localhost:${config.PORT}/api/health`);
  console.log(`   - 会话管理: http://localhost:${config.PORT}/api/conversations`);
  console.log(`   - 转人工: http://localhost:${config.PORT}/api/escalations`);
  console.log(`   - 结果处理: http://localhost:${config.PORT}/api/processing`);
  console.log(`   - 报告查询: http://localhost:${config.PORT}/api/reports`);
  console.log(`\n💡 运行演示: npm run demo`);
  console.log(`💡 造数脚本: npm run seed\n`);
});

module.exports = app;
