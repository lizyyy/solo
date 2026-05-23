const express = require('express');
const fs = require('fs');
const path = require('path');
const sequelize = require('./config/database');

const batchRoutes = require('./routes/batches');
const lossRoutes = require('./routes/loss');
const exportRoutes = require('./routes/exports');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Operator: ${req.headers.operator || 'unknown'}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ success: true, message: '生鲜分拣损耗验收回放链路服务运行中' });
});

app.use('/api/batches', batchRoutes);
app.use('/api/loss', lossRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/audit', auditRoutes);

app.use((err, req, res, next) => {
  console.error('错误:', err);
  res.status(500).json({ success: false, error: err.message, stack: err.stack });
});

async function startServer() {
  try {
    await sequelize.sync({ force: false });
    console.log('数据库同步完成');
    
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
      ║                                                            ║
      ║   生鲜分拣损耗验收回放链路服务                             ║
      ║                                                            ║
      ║   服务地址: http://localhost:${PORT}                        ║
      ║   健康检查: http://localhost:${PORT}/health                  ║
      ║                                                            ║
      ║   API接口:                                                  ║
      ║     POST   /api/batches              - 创建批次             ║
      ║     GET    /api/batches              - 批次列表             ║
      ║     GET    /api/batches/:id          - 批次详情             ║
      ║     POST   /api/batches/:id/submit   - 提交批次             ║
      ║     POST   /api/batches/:id/withdraw - 撤回批次             ║
      ║     POST   /api/batches/:id/freeze   - 冻结批次             ║
      ║     POST   /api/batches/:id/reconcile - 对账                 ║
      ║     POST   /api/batches/:id/export    - 导出                 ║
      ║     GET    /api/batches/:id/replay    - 回放时间线           ║
      ║                                                            ║
      ╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();
