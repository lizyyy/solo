const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config/config');
const { initDatabase, db } = require('./database/db');
const transferRoutes = require('./routes/transferRoutes');

const app = express();

app.use(bodyParser.json());

async function startServer() {
  console.log('========================================');
  console.log('    医院转诊床位协调 API');
  console.log('========================================');

  const isFirstRun = await initDatabase();

  if (isFirstRun) {
    console.log('\n✓ 数据库初始化完成');
    try {
      const { seed } = require('./scripts/seed');
      seed();
      console.log('✓ 样例数据已加载');
    } catch (e) {
      console.log('⚠ 首次运行，数据库已创建');
    }
  } else {
    console.log('\n✓ 连接到现有数据库');
  }

  app.use('/api/v1', transferRoutes);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: '医院转诊床位协调 API', timestamp: new Date().toISOString() });
  });

  app.get('/', (req, res) => {
    res.json({
      name: '医院转诊床位协调 API',
      version: '1.0.0',
      health: '/health',
      endpoints: {
        patients: '/api/v1/patients',
        requests: '/api/v1/requests',
        beds: '/api/v1/beds/status',
        reports: '/api/v1/reports/dashboard',
        exceptions: '/api/v1/exceptions'
      },
      demo: '运行 npm run demo 查看演示流程'
    });
  });

  app.listen(config.port, () => {
    console.log(`\n✓ 服务已启动: http://localhost:${config.port}`);
    console.log('========================================\n');
  });
}

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
