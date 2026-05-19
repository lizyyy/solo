const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./models');
const routes = require('./api/routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api', routes);

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.listen(PORT, async () => {
  console.log(`印刷品控系统服务启动中...`);
  console.log(`端口: ${PORT}`);
  
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    console.log(`API服务已启动: http://localhost:${PORT}/api`);
    console.log('健康检查: http://localhost:${PORT}/api/health');
  } catch (error) {
    console.error('数据库初始化失败:', error.message);
  }
});

module.exports = app;
