const express = require('express');
const tasksRouter = require('./routes/tasks');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '文件病毒扫描回调服务',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/tasks', tasksRouter);
app.use('/api/admin', adminRouter);

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    code: 'SERVER_ERROR',
    message: '服务器内部错误',
    error: err.message
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  文件病毒扫描回调服务已启动`);
  console.log(`  服务端口: ${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log(`========================================\n`);
});
