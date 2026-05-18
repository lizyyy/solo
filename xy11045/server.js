const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const importRoutes = require('./routes/importRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/supplement-records', importRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '体检中心体检报告补寄 API 运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    errorCode: 'NOT_FOUND',
    errorMessage: '接口不存在',
    details: `请求的路径 ${req.method} ${req.path} 未找到`
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    errorCode: 'INTERNAL_SERVER_ERROR',
    errorMessage: '服务器内部错误',
    details: err.message || '发生未预期的错误，请联系技术支持'
  });
});

app.listen(PORT, () => {
  console.log(`体检中心体检报告补寄 API 已启动，监听端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`导入接口: http://localhost:${PORT}/api/supplement-records/import`);
});

module.exports = app;
