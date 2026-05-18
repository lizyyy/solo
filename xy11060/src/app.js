const express = require('express');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
const uploadsDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const lossReportRoutes = require('./routes/lossReportRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '蔬菜配送站损耗申报API服务运行正常' });
});

app.use('/api/loss-reports', lossReportRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

app.listen(PORT, () => {
  console.log(`蔬菜配送站损耗申报API服务已启动，运行在端口 ${PORT}`);
  console.log(`健康检查地址: http://localhost:${PORT}/health`);
  console.log(`API文档地址: http://localhost:${PORT}/api/loss-reports`);
});

module.exports = app;
