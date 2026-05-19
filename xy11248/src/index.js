const express = require('express');
const path = require('path');

const ordersRouter = require('./routes/orders');
const compensationsRouter = require('./routes/compensations');
const settlementsRouter = require('./routes/settlements');
const couponsRouter = require('./routes/coupons');
const batchesRouter = require('./routes/batches');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    message: '团长运营后台系统 API',
    version: '1.0.0',
    endpoints: {
      orders: '/api/orders',
      compensations: '/api/compensations',
      settlements: '/api/settlements',
      coupons: '/api/coupons',
      batches: '/api/batches'
    }
  });
});

app.use('/api/orders', ordersRouter);
app.use('/api/compensations', compensationsRouter);
app.use('/api/settlements', settlementsRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/batches', batchesRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('数据库初始化请运行: npm run init-db');
});
