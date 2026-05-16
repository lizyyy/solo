const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const deletionRequestsRoutes = require('./routes/deletionRequests');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'deletion.db');
if (!fs.existsSync(dbPath)) {
  console.log('初始化数据库...');
  try {
    execSync('node src/scripts/initDB.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  } catch (err) {
    console.error('数据库初始化失败:', err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'data-deletion-grace-api',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/deletion-requests', deletionRequestsRoutes);

app.get('/api/status-definitions', (req, res) => {
  res.json({
    DELETION_STATUS: {
      PENDING: '待处理',
      IN_GRACE_PERIOD: '宽限期内',
      REVOCATION_REQUESTED: '撤销申请中',
      REVOKED: '已撤销',
      PURGE_SCHEDULED: '清除已调度',
      PURGE_IN_PROGRESS: '清除进行中',
      PURGED: '已清除',
      ERROR: '错误',
      CANCELLED: '已取消'
    },
    REVOCATION_STATUS: {
      PENDING: '待审核',
      APPROVED: '已批准',
      REJECTED: '已拒绝'
    },
    PURGE_TASK_STATUS: {
      SCHEDULED: '已调度',
      IN_PROGRESS: '进行中',
      COMPLETED: '已完成',
      FAILED: '失败'
    },
    VALID_TRANSITIONS: {
      PENDING: ['IN_GRACE_PERIOD', 'CANCELLED', 'ERROR'],
      IN_GRACE_PERIOD: ['REVOCATION_REQUESTED', 'PURGE_SCHEDULED', 'ERROR'],
      REVOCATION_REQUESTED: ['REVOKED', 'IN_GRACE_PERIOD', 'ERROR'],
      REVOKED: [],
      PURGE_SCHEDULED: ['PURGE_IN_PROGRESS', 'ERROR'],
      PURGE_IN_PROGRESS: ['PURGED', 'ERROR'],
      PURGED: [],
      ERROR: ['IN_GRACE_PERIOD', 'PURGE_SCHEDULED', 'CANCELLED'],
      CANCELLED: []
    }
  });
});

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在',
      details: `路径 ${req.path} 不存在`
    },
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           数据删除宽限期 API 服务已启动                         ║
╠══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                             ║
║  健康检查: http://localhost:${PORT}/health                      ║
║  状态定义: http://localhost:${PORT}/api/status-definitions      ║
╠══════════════════════════════════════════════════════════════╣
║  基础路径: /api/deletion-requests                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
