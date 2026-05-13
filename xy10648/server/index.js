const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const budgetsRouter = require('./routes/budgets');
const activitiesRouter = require('./routes/activities');
const purchasesRouter = require('./routes/purchases');
const invoicesRouter = require('./routes/invoices');
const supplementsRouter = require('./routes/supplements');
const paymentsRouter = require('./routes/payments');
const logsRouter = require('./routes/logs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../client/build')));

app.use('/api/budgets', budgetsRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/supplements', supplementsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/logs', logsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '社团经费报销系统运行正常' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`
========================================
  社团经费票据报销系统
========================================
  后端服务运行在: http://localhost:${PORT}
  API文档:
    GET  /api/health - 健康检查
    GET  /api/budgets - 预算列表
    GET  /api/activities - 活动列表
    GET  /api/purchases - 采购列表
    GET  /api/invoices - 票据列表
    GET  /api/supplements - 补资料列表
    GET  /api/payments - 支付列表
    GET  /api/logs - 操作日志
    GET  /api/logs/export - 导出Excel
========================================
  初始化数据命令: npm run init-db
  开发模式命令: npm run dev
========================================
  `);
});
