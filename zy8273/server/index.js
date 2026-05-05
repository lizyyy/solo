const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase, getSchemaVersion } = require('./database');

const draftsRouter = require('./routes/drafts');
const submissionsRouter = require('./routes/submissions');

const app = express();
const PORT = process.env.PORT || 3000;

async function startServer() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  await initDatabase();

  app.use(cors());
  app.use(express.json());

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/health', (req, res) => {
    res.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      schemaVersion: getSchemaVersion()
    });
  });

  app.use('/api/drafts', draftsRouter);
  app.use('/api/submissions', submissionsRouter);

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  });

  app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`采购立项申请系统已启动`);
    console.log(`========================================`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`API 地址: http://localhost:${PORT}/api`);
    console.log(`当前 Schema 版本: ${getSchemaVersion()}`);
    console.log(`========================================`);
    console.log(`首次使用请运行: npm run init-db`);
    console.log(`以添加示例数据`);
    console.log(`========================================`);
  });
}

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
