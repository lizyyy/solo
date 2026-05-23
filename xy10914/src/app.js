const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { initializeDatabase } = require('./database');
const exceptionRoutes = require('./routes/exceptionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '外卖骑手异常单API服务运行正常' });
});

app.use('/api', exceptionRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

async function startServer() {
  try {
    await initializeDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`
============================================
外卖骑手异常单 API 服务已启动
服务地址: http://localhost:${PORT}
健康检查: http://localhost:${PORT}/health
API 文档: http://localhost:${PORT}/api
============================================
      `);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

startServer();
