const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initDatabase } = require('./database/db');

const reportsRouter = require('./routes/reports');
const importRouter = require('./routes/import');
const exportRouter = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '骑行俱乐部骑行保险报案API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/reports', reportsRouter);
app.use('/api/import', importRouter);
app.use('/api/export', exportRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: '未找到',
    message: '请求的资源不存在'
  });
});

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`\n🚀 骑行俱乐部骑行保险报案API服务已启动`);
      console.log(`📍 服务地址: http://localhost:${PORT}`);
      console.log(`🔍 健康检查: http://localhost:${PORT}/api/health`);
      console.log(`\n📋 API 端点:`);
      console.log(`   GET    /api/reports        - 查询报案列表`);
      console.log(`   GET    /api/reports/:id    - 查询单个报案`);
      console.log(`   POST   /api/reports        - 创建报案`);
      console.log(`   PUT    /api/reports/:id    - 更新报案`);
      console.log(`   DELETE /api/reports/:id    - 删除报案`);
      console.log(`   POST   /api/import/batch   - 批量导入`);
      console.log(`   GET    /api/export/csv     - 导出CSV`);
      console.log(`   GET    /api/export/json    - 导出JSON\n`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();
