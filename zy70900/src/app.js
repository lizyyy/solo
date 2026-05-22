const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const batchRoutes = require('./routes/batchRoutes');
const recordRoutes = require('./routes/recordRoutes');

require('./database/schema');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '景区设备部检修记录追踪服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/batches', batchRoutes);
app.use('/api/records', recordRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误: ' + err.message
  });
});

app.listen(PORT, () => {
  console.log(`
============================================
  景区设备部检修记录追踪服务已启动
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/api/health
============================================
  `);
});

module.exports = app;
