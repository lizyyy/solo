const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const initSchema = require('./config/schema');
const partsRouter = require('./routes/parts');
const receptionsRouter = require('./routes/receptions');
const reportsRouter = require('./routes/reports');
const { success } = require('./utils/response');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

initSchema();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json(success({
    name: '检修备件最低库存 API',
    version: '1.0.0',
    description: '工厂检修备件库存管理系统',
    endpoints: {
      parts: 'GET/POST /api/parts',
      receptions: 'GET/POST /api/receptions',
      reports: 'GET /api/reports/*',
      demo: '查看 README.md 了解演示路径'
    }
  }, 'API 服务正常运行'));
});

app.use('/api/parts', partsRouter);
app.use('/api/receptions', receptionsRouter);
app.use('/api/reports', reportsRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    code: 500,
    message: err.message || '服务器内部错误',
    timestamp: Date.now()
  });
});

app.listen(PORT, () => {
  console.log(`=`);
  console.log(`检修备件最低库存 API`);
  console.log(`服务已启动: http://localhost:${PORT}`);
  console.log(`=`);
  console.log(`主要接口:`);
  console.log(`  GET  http://localhost:${PORT}/                    - 服务健康检查`);
  console.log(`  GET  http://localhost:${PORT}/api/parts          - 备件列表`);
  console.log(`  GET  http://localhost:${PORT}/api/receptions     - 领用单列表`);
  console.log(`  GET  http://localhost:${PORT}/api/reports/full   - 综合报告`);
  console.log(`  GET  http://localhost:${PORT}/api/reports/export - 导出文本报告`);
  console.log(`=`);
  console.log(`运行演示: npm run demo`);
  console.log(`运行失败演示: npm run demo-failure`);
  console.log(`=`);
});

module.exports = app;
