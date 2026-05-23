const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./config/database');

const receiveRoutes = require('./routes/receive');
const factsRoutes = require('./routes/facts');
const queueRoutes = require('./routes/queue');
const dirtyRoutes = require('./routes/dirty');
const exportRoutes = require('./routes/export');
const deadletterRoutes = require('./routes/deadletter');
const notesRoutes = require('./routes/notes');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

initDatabase();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'park-visitor-compensation-queue'
  });
});

app.use('/api/receive', receiveRoutes);
app.use('/api/facts', factsRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/dirty', dirtyRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/deadletter', deadletterRoutes);
app.use('/api/notes', notesRoutes);

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
====================================================
    园区访客通行重试补偿队列 API 服务
====================================================
服务已启动: http://localhost:${PORT}
健康检查:   http://localhost:${PORT}/health

API 接口:
  POST /api/receive/appointment   - 提交访客预约
  POST /api/receive/gate-record   - 提交闸机记录
  POST /api/receive/screenshot    - 提交车牌截图
  
  GET  /api/facts                 - 事实记录列表
  GET  /api/facts/:factId         - 事实记录详情
  
  GET  /api/queue/stats           - 队列统计
  GET  /api/queue/next            - 获取待处理队列
  POST /api/queue/:id/retry       - 执行重试
  POST /api/queue/:id/complete    - 标记完成
  POST /api/queue/:id/manual      - 转人工处理
  
  GET  /api/dirty                 - 脏记录列表
  GET  /api/dirty/stats           - 脏记录统计
  POST /api/dirty/:id/handle      - 处理脏记录
  
  GET  /api/deadletter            - 死信队列
  POST /api/deadletter/:id/recover - 从死信恢复
  
  GET  /api/export/facts          - 导出事实CSV
  GET  /api/export/dirty-records  - 导出脏记录CSV
  GET  /api/export/security-report - 生成安保主管报告
====================================================
    `);
  });
}

module.exports = app;
