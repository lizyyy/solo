const express = require('express');
const { initSampleData } = require('./models/Seal');
const sealRoutes = require('./routes/sealRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', sealRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '印章外借审批 API 运行正常' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

initSampleData();

app.listen(PORT, () => {
  console.log(`🚀 印章外借审批 API 已启动，运行在端口 ${PORT}`);
  console.log(`📋 健康检查: http://localhost:${PORT}/health`);
  console.log(`🔗 API 基础地址: http://localhost:${PORT}/api`);
});

module.exports = app;