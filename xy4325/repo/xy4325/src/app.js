require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const devicesRouter = require('./routes/devices');
const borrowRouter = require('./routes/borrow');
const groupsRouter = require('./routes/groups');
const studentsRouter = require('./routes/students');
const overdueRouter = require('./routes/overdue');
const exportRouter = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/devices', devicesRouter);
app.use('/api/borrow', borrowRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/students', studentsRouter);
app.use('/api/overdue', overdueRouter);
app.use('/api/export', exportRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: '传感器借还管理系统运行正常'
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: '参数验证失败',
      message: err.message
    });
  }
  
  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      error: '资源不存在',
      message: err.message
    });
  }
  
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({
      error: '数据冲突',
      message: '唯一约束违反，可能是重复的 ID 或名称'
    });
  }
  
  res.status(500).json({
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '请联系管理员'
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 文档示例:`);
  console.log(`- 健康检查: GET http://localhost:${PORT}/api/health`);
  console.log(`- 设备列表: GET http://localhost:${PORT}/api/devices`);
});

module.exports = app;
