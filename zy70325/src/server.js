const express = require('express');
const uploadService = require('./services/uploadService');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/upload', uploadRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

async function startServer() {
  await uploadService.init();
  app.listen(PORT, () => {
    console.log(`大文件分片上传 API 服务已启动`);
    console.log(`端口: ${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    console.log(`API 端点: http://localhost:${PORT}/api/upload`);
  });
}

startServer().catch(error => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});
