const express = require('express');
const path = require('path');
const database = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

const ordersRouter = require('./routes/orders');
const liabilityRouter = require('./routes/liability');
const evidenceRouter = require('./routes/evidence');
const rejudgeRouter = require('./routes/rejudge');
const costsRouter = require('./routes/costs');
const reportsRouter = require('./routes/reports');

app.use((req, res, next) => {
  database.waitForInit().then(() => next());
});

app.use('/api/orders', ordersRouter);
app.use('/api/liability', liabilityRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/rejudge', rejudgeRouter);
app.use('/api/costs', costsRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/constants', (req, res) => {
  res.json({
    responsibilities: [
      { code: 'ASSEMBLY', name: '装配' },
      { code: 'TESTING', name: '测试' },
      { code: 'PACKAGING', name: '包装' }
    ],
    order_statuses: {
      PENDING: '待处理',
      PROCESSING: '处理中',
      FREEZED: '责任冻结',
      REJUDGING: '复判中',
      SETTLED: '已结算',
      CLOSED: '已关闭'
    },
    rejudge_statuses: {
      PENDING: '待审批',
      APPROVED: '已通过',
      REJECTED: '已驳回'
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: err.message });
});

database.initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  返修责任冻结服务已启动`);
    console.log(`  访问地址: http://localhost:${PORT}`);
    console.log(`========================================\n`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
