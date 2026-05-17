const express = require('express');
const { errorHandler } = require('./middleware/errorHandler');
const articlesRouter = require('./routes/articles');
const { initDatabase } = require('./models/database');

const app = express();
const PORT = process.env.PORT || 3000;

(async () => {
  await initDatabase();
})();

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use('/api/articles', articlesRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

app.listen(PORT, () => {
  console.log(`知识库过期提醒API服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});

module.exports = app;
