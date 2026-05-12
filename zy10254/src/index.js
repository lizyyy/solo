const express = require('express');
const bodyParser = require('body-parser');
const { initDatabase } = require('./database/db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '车辆救援派单 API 服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

initDatabase();

app.listen(PORT, () => {
  console.log(`\n🚀 车辆救援派单 API 服务已启动`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`💊 健康检查: http://localhost:${PORT}/health`);
  console.log(`📖 API 文档: 请查看 README.md\n`);
});