const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { resetDB, loadDB } = require('./utils/db');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    timestamp: new Date().toISOString(),
    service: '采购返利核算API服务'
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '采购返利核算API服务',
    endpoints: {
      health: 'GET /health',
      suppliers: {
        list: 'GET /api/suppliers',
        create: 'POST /api/suppliers',
        detail: 'GET /api/suppliers/:id',
        history: 'GET /api/suppliers/:id/history'
      },
      rebate_rules: {
        list: 'GET /api/rebate-rules',
        create: 'POST /api/rebate-rules',
        detail: 'GET /api/rebate-rules/:id',
        activate: 'POST /api/rebate-rules/:id/activate',
        suspend: 'POST /api/rebate-rules/:id/suspend',
        archive: 'POST /api/rebate-rules/:id/archive',
        history: 'GET /api/rebate-rules/:id/history',
        applicable: 'GET /api/rebate-rules/applicable/:supplierId/:period'
      },
      sales: {
        list: 'GET /api/sales',
        create: 'POST /api/sales',
        detail: 'GET /api/sales/:id',
        history: 'GET /api/sales/:id/history',
        summary: 'GET /api/sales/summary/:supplierId/:period'
      },
      returns: {
        list: 'GET /api/returns',
        create: 'POST /api/returns',
        detail: 'GET /api/returns/:id',
        history: 'GET /api/returns/:id/history',
        summary: 'GET /api/returns/summary/:supplierId/:period'
      },
      reconciliation: {
        list: 'GET /api/reconciliation',
        calculate: 'POST /api/reconciliation/calculate',
        detail: 'GET /api/reconciliation/:id',
        submit_confirmation: 'POST /api/reconciliation/:id/submit-confirmation',
        history: 'GET /api/reconciliation/:id/history',
        confirm: 'POST /api/reconciliation/:summaryId/confirm',
        reject: 'POST /api/reconciliation/:summaryId/reject',
        export: 'GET /api/reconciliation/export/data',
        statistics: 'GET /api/reconciliation/statistics'
      },
      confirmation_letters: {
        list: 'GET /api/reconciliation/confirmation-letters',
        create: 'POST /api/reconciliation/confirmation-letters',
        detail: 'GET /api/reconciliation/confirmation-letters/:id',
        send: 'POST /api/reconciliation/confirmation-letters/:id/send'
      }
    },
    note: '可使用 X-Operator 请求头指定操作人，便于审计追踪'
  });
});

const suppliersRouter = require('./routes/suppliers');
const rebateRulesRouter = require('./routes/rebateRules');
const salesRouter = require('./routes/sales');
const returnsRouter = require('./routes/returns');
const reconciliationRouter = require('./routes/reconciliation');

app.use('/api/suppliers', suppliersRouter);
app.use('/api/rebate-rules', rebateRulesRouter);
app.use('/api/sales', salesRouter);
app.use('/api/returns', returnsRouter);
app.use('/api/reconciliation', reconciliationRouter);

app.use((err, req, res, next) => {
  console.error('错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.url
  });
});

const DB_FILE = path.join(__dirname, 'database', 'data.json');
if (!fs.existsSync(DB_FILE)) {
  console.log('数据库文件不存在，正在初始化...');
  resetDB();
  loadDB();
} else {
  loadDB();
}

app.listen(PORT, () => {
  console.log(`
========================================
  采购返利核算API服务已启动
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/health
  API文档:  http://localhost:${PORT}/
========================================
  `);
});
