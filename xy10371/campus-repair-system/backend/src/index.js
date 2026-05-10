const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

async function startServer() {
  const app = express();
  const PORT = 3001;

  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  app.use(cors());
  app.use(express.json());

  const { initDatabase, seedData } = require('./database');
  await initDatabase();
  seedData();

  const routes = require('./routes');
  app.use('/api', routes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '校园报修派工系统后端运行正常' });
  });

  app.listen(PORT, () => {
    console.log(`校园报修派工系统后端已启动，运行在端口 ${PORT}`);
    console.log(`API 地址: http://localhost:${PORT}/api`);
  });
}

startServer().catch(err => {
  console.error('启动服务器失败:', err);
  process.exit(1);
});
