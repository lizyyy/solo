const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');
const { seedData } = require('./seedData');
const routes = require('./routes');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  await initDatabase();
  seedData();

  app.listen(PORT, () => {
    console.log(`影院排片换厅系统后端服务已启动: http://localhost:${PORT}`);
    console.log('API文档:');
    console.log('  GET  /api/movies              - 获取影片列表');
    console.log('  POST /api/movies              - 添加影片');
    console.log('  GET  /api/halls               - 获取影厅列表');
    console.log('  POST /api/halls               - 添加影厅');
    console.log('  GET  /api/halls/:id/seats     - 获取影厅座位');
    console.log('  GET  /api/schedules           - 获取排片列表');
    console.log('  POST /api/schedules           - 添加排片');
    console.log('  GET  /api/schedules/:id/tickets - 获取排片售票');
    console.log('  POST /api/hall-exchange       - 创建换厅申请');
    console.log('  GET  /api/hall-exchange/:id   - 获取换厅详情');
    console.log('  POST /api/hall-exchange/:id/complete - 完成换厅');
  });
}

startServer();
