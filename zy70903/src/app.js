const express = require('express');
const bodyParser = require('body-parser');
const batchRoutes = require('./routes/batchRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', batchRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '景区缆车检修放行API服务运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`景区缆车检修放行API服务已启动，监听端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API文档: http://localhost:${PORT}/api/`);
});

module.exports = app;
