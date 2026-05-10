const express = require('express');
const bodyParser = require('body-parser');
const { initDatabase } = require('./src/database/database');

const projectsRouter = require('./src/routes/projects');
const milestonesRouter = require('./src/routes/milestones');
const acceptancesRouter = require('./src/routes/acceptances');
const invoicesRouter = require('./src/routes/invoices');
const paymentsRouter = require('./src/routes/payments');
const reportsRouter = require('./src/routes/reports');
const auditRouter = require('./src/routes/audit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '里程碑收款服务运行中',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/projects', projectsRouter);
app.use('/api/milestones', milestonesRouter);
app.use('/api/acceptances', acceptancesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/audit', auditRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

initDatabase();

app.listen(PORT, () => {
  console.log(`里程碑收款服务启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});
