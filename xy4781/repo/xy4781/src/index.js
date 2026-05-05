const express = require('express');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./database/connection');
const initSchema = require('./database/schema');
const prescriptionsRouter = require('./routes/prescriptions');
const fulfillmentsRouter = require('./routes/fulfillments');
const auditRouter = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3002;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/prescriptions', prescriptionsRouter);
app.use('/api/fulfillments', fulfillmentsRouter);
app.use('/api/audit', auditRouter);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: '处方取药幂等核销台'
    }
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: '处方取药幂等核销台',
      version: '1.0.0',
      description: '社区药房处方取药幂等核销REST API服务',
      endpoints: {
        health: 'GET /health',
        prescriptions: {
          list: 'GET /api/prescriptions',
          get: 'GET /api/prescriptions/:idOrNo',
          create: 'POST /api/prescriptions',
          inventory: 'GET /api/prescriptions/inventory'
        },
        fulfillments: {
          list: 'GET /api/fulfillments',
          get: 'GET /api/fulfillments/:idOrNo',
          fulfill: 'POST /api/fulfillments/fulfill (需要 X-Idempotency-Key 头)',
          cancel: 'POST /api/fulfillments/cancel (需要 X-Idempotency-Key 头)',
          payments: 'GET /api/fulfillments/payments',
          idempotencyCheck: 'GET /api/fulfillments/idempotency/:key'
        },
        audit: {
          reconciliation: 'GET /api/audit/reconciliation',
          logs: 'GET /api/audit/logs',
          stats: 'GET /api/audit/stats',
          reportJson: 'GET /api/audit/report/json',
          reportMarkdown: 'GET /api/audit/report/markdown',
          reportPreview: 'GET /api/audit/report/preview'
        }
      }
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  if (err.code === 'SQLITE_CONSTRAINT' || (err.message && err.message.includes('UNIQUE constraint'))) {
    return res.status(409).json({
      success: false,
      error: {
        message: '数据约束冲突',
        code: 'CONSTRAINT_VIOLATION'
      }
    });
  }

  res.status(500).json({
    success: false,
    error: {
      message: err.message || '内部服务器错误',
      code: err.code || 'INTERNAL_ERROR'
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: '接口不存在',
      code: 'NOT_FOUND'
    }
  });
});

const startServer = async () => {
  try {
    console.log('正在初始化数据库...');
    await initDatabase();
    console.log('数据库连接已建立');
    
    initSchema();
    console.log('数据库模式初始化完成');
    
    app.listen(PORT, () => {
      console.log(`========================================`);
      console.log(`处方取药幂等核销台服务已启动`);
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
      console.log(`API文档: http://localhost:${PORT}/`);
      console.log(`========================================`);
      console.log(`使用说明:`);
      console.log(`- 核销和撤销核销操作需要在请求头中携带 X-Idempotency-Key`);
      console.log(`- 幂等键建议使用: 业务场景标识 + 时间戳 + 随机数`);
      console.log(`- 示例: FULFILL-20260505-ABC123`);
      console.log(`========================================`);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
