const express = require('express');
const fs = require('fs');
const path = require('path');
const routes = require('./routes');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`数据标注平台任务包拆分返工 API 已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API 前缀: http://localhost:${PORT}/api`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
