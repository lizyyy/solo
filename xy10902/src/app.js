const express = require('express');
const initDatabase = require('./config/initDb');

const vehiclesRouter = require('./routes/vehicles');
const plansRouter = require('./routes/plans');
const gateEventsRouter = require('./routes/gateEvents');
const deductionsRouter = require('./routes/deductions');
const supplementaryRouter = require('./routes/supplementary');
const reconciliationRouter = require('./routes/reconciliation');
const exceptionsRouter = require('./routes/exceptions');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

initDatabase(() => {
  console.log('数据库表结构初始化完成');
});

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api/v1/vehicles', vehiclesRouter);
app.use('/api/v1/plans', plansRouter);
app.use('/api/v1/gate-events', gateEventsRouter);
app.use('/api/v1/deductions', deductionsRouter);
app.use('/api/v1/supplementary', supplementaryRouter);
app.use('/api/v1/reconciliation', reconciliationRouter);
app.use('/api/v1/exceptions', exceptionsRouter);

app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: '停车场月租扣费API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`
=========================================
  停车场月租扣费 API 服务
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/api/v1/health
  启动时间: ${new Date().toISOString()}
=========================================
  `);
});

module.exports = app;
