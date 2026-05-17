const express = require('express');
const rotationsRouter = require('./routes/rotations');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/rotations', rotationsRouter);

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     服务目录 Owner 轮转 API 已启动                            ║
║                                                              ║
║     服务地址: http://localhost:${PORT}                           ║
║     健康检查: http://localhost:${PORT}/health                    ║
║     API 文档: 查看 README.md                                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
