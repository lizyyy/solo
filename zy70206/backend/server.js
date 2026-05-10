const express = require('express');
const cors = require('cors');
const { initDatabase, STATUSES, STATUS_INFO } = require('./models/database');

const chemicalsRoutes = require('./routes/chemicals');
const requisitionsRoutes = require('./routes/requisitions');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

initDatabase();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '危化品领用台服务运行正常' });
});

app.get('/api/statuses', (req, res) => {
  res.json({
    STATUSES,
    STATUS_INFO
  });
});

app.use('/api/chemicals', chemicalsRoutes);
app.use('/api/requisitions', requisitionsRoutes);
app.use('/api/users', usersRoutes);

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: '服务器内部错误',
    suggestion: '请联系管理员或稍后重试'
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  校园实验危化品领用台 - 后端服务`);
  console.log(`========================================`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API 前缀: http://localhost:${PORT}/api`);
  console.log(`\n可用端点:`);
  console.log(`  GET  /api/health          - 健康检查`);
  console.log(`  GET  /api/statuses        - 业务状态枚举`);
  console.log(`  GET  /api/users           - 用户列表`);
  console.log(`  GET  /api/chemicals       - 危化品台账`);
  console.log(`  GET  /api/requisitions    - 领用单列表`);
  console.log(`\n前端请打开: ../frontend/index.html`);
  console.log(`========================================\n`);
});
