const express = require('express');
const config = require('./config');
const db = require('./database/connection');
const projectsRouter = require('./routes/projects');
const lutsRouter = require('./routes/luts');
const fs = require('fs-extra');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/projects', projectsRouter);
app.use('/api/luts', lutsRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

async function startServer() {
  try {
    console.log('正在初始化存储目录...');
    await fs.ensureDir(config.storage.lutDir);
    await fs.ensureDir(config.storage.archiveDir);
    await fs.ensureDir(config.storage.exportDir);
    await fs.ensureDir(config.storage.tempDir);

    console.log('正在连接数据库...');
    await db.connect();

    console.log('正在初始化数据库表...');
    const { createTables } = require('./database/schema');
    const statements = createTables.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.run(stmt + ';');
      }
    }

    app.listen(config.port, () => {
      console.log(`\n========================================`);
      console.log(`  电影调色LUT台账服务已启动`);
      console.log(`  服务地址: http://localhost:${config.port}`);
      console.log(`  健康检查: http://localhost:${config.port}/health`);
      console.log(`========================================\n`);
      console.log('API 端点:');
      console.log('  POST /api/projects         - 创建项目');
      console.log('  GET  /api/projects         - 获取项目列表');
      console.log('  POST /api/luts/upload      - 上传LUT');
      console.log('  POST /api/luts/overwrite   - 覆盖版本');
      console.log('  POST /api/luts/supplement  - 补录LUT');
      console.log('  GET  /api/luts/:uuid       - 获取LUT详情');
      console.log('  POST /api/luts/:uuid/withdraw - 撤回LUT');
      console.log('  GET  /api/luts/conflicts/list - 查看冲突列表');
      console.log('');
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();
