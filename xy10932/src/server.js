const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const { initDatabase } = require('./database');
const routes = require('./routes');
const { checkAndUpdateExpiredSamples } = require('./businessLogic');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: '餐厅预制菜留样API',
    version: '1.0.0',
    description: '中央厨房预制菜留样追溯管理系统',
    endpoints: {
      health: 'GET /api/health',
      batches: 'GET/POST /api/batches',
      sample_boxes: 'GET/POST /api/sample-boxes',
      storage_locations: 'GET/POST /api/storage-locations',
      inspections: 'GET/POST /api/inspections',
      destructions: 'GET/POST /api/destructions',
      trace_reports: 'GET/POST /api/trace-reports',
      exception_logs: 'GET /api/exception-logs',
      manual_corrections: 'GET/POST /api/manual-corrections',
      statistics: 'GET /api/statistics/summary',
      export: 'GET /api/export/trace-report/:id'
    }
  });
});

const startServer = async () => {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    await checkAndUpdateExpiredSamples();
    console.log('过期留样检查完成');
    
    setInterval(async () => {
      try {
        const expiredCount = await checkAndUpdateExpiredSamples();
        if (expiredCount > 0) {
          console.log(`自动更新了 ${expiredCount} 个过期留样状态`);
        }
      } catch (error) {
        console.error('定时检查过期留样失败:', error);
      }
    }, 60 * 60 * 1000);
    
    app.listen(PORT, () => {
      console.log(`
========================================
餐厅预制菜留样API服务启动成功
服务地址: http://localhost:${PORT}
API地址: http://localhost:${PORT}/api
健康检查: http://localhost:${PORT}/api/health
========================================
      `);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();
