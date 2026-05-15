const express = require('express');
const tokenRoutes = require('./routes/tokenRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/tokens', tokenRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'rollback-token-service' });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    errorCode: 'NOT_FOUND',
    errorMessage: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    errorCode: 'INTERNAL_ERROR',
    errorMessage: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`回滚令牌服务运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 基础路径: http://localhost:${PORT}/api/tokens`);
});

module.exports = app;
