const express = require('express');
const errorHandler = require('./middleware/errorHandler');

const petsRouter = require('./routes/pets');
const ordersRouter = require('./routes/orders');
const medicationPlansRouter = require('./routes/medicationPlans');
const shiftExecutionsRouter = require('./routes/shiftExecutions');
const changeConfirmationsRouter = require('./routes/changeConfirmations');
const careReportsRouter = require('./routes/careReports');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('X-Request-Id', req.headers['x-request-id'] || require('uuid').v4());
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: '宠物寄养喂药API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/pets', petsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/medication-plans', medicationPlansRouter);
app.use('/api/shift-executions', shiftExecutionsRouter);
app.use('/api/change-confirmations', changeConfirmationsRouter);
app.use('/api/care-reports', careReportsRouter);

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: '欢迎使用宠物寄养喂药API',
    version: '1.0.0',
    endpoints: {
      pets: '/api/pets',
      orders: '/api/orders',
      medication_plans: '/api/medication-plans',
      shift_executions: '/api/shift-executions',
      change_confirmations: '/api/change-confirmations',
      care_reports: '/api/care-reports'
    }
  });
});

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    status: 'not_found',
    message: '请求的资源不存在'
  });
});

module.exports = app;
