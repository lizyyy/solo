const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/tasks', require('./routes/tasks'));

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    service: '陪检管理系统',
    version: '1.0.0'
  });
});

app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: '接口不存在',
    path: req.path 
  });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    success: false, 
    error: '服务器内部错误',
    message: err.message 
  });
});

app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 陪检管理系统后端服务已启动');
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`🔍 健康检查: http://localhost:${PORT}/api/health`);
  console.log('='.repeat(50));
  console.log('');
  console.log('📋 快速开始:');
  console.log('  1. 初始化数据库: npm run init-db');
  console.log('  2. 导入样例数据: npm run import-sample');
  console.log('  3. 查看任务列表: GET /api/tasks');
  console.log('');
});
