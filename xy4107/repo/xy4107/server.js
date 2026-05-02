const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const usersRouter = require('./src/routes/users');
const authRouter = require('./src/routes/auth');
const auditRouter = require('./src/routes/audit');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/audit', auditRouter);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    service: '无密码登录彩排台',
    version: '1.0.0'
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误'
  });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: 'API端点不存在'
    });
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

const PORT = config.port || 3000;

app.listen(PORT, () => {
  console.log('========================================');
  console.log('  无密码登录彩排台');
  console.log('  Passkey Rehearsal Platform');
  console.log('========================================');
  console.log(`服务已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('API 端点:');
  console.log(`  GET  /api/health           - 健康检查`);
  console.log(`  GET  /api/users            - 用户列表`);
  console.log(`  POST /api/users            - 创建用户`);
  console.log(`  POST /api/auth/register/start  - 开始注册`);
  console.log(`  POST /api/auth/register/complete - 完成注册`);
  console.log(`  POST /api/auth/login/start     - 开始登录`);
  console.log(`  POST /api/auth/login/complete  - 完成登录`);
  console.log(`  POST /api/auth/login/backup-code - 备用码登录`);
  console.log(`  GET  /api/audit              - 审计日志`);
  console.log(`  GET  /api/audit/stats        - 统计数据`);
  console.log(`  GET  /api/audit/export/report - 导出报告`);
  console.log(`  GET  /api/audit/export/audit  - 导出审计包`);
  console.log('');
  console.log('按 Ctrl+C 停止服务');
  console.log('========================================');
});
