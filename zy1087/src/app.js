const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const { errorHandler } = require('./utils/errors');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const disputeRoutes = require('./routes/disputes');
const exportRoutes = require('./routes/export');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/disputes', disputeRoutes);
app.use('/api/v1/export', exportRoutes);

app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    },
    message: '服务运行正常'
  });
});

app.get('/api/v1', (req, res) => {
  res.json({
    success: true,
    data: {
      name: '二手电子产品验货担保交易 API',
      version: '1.0.0',
      endpoints: {
        auth: '/api/v1/auth',
        products: '/api/v1/products',
        orders: '/api/v1/orders',
        disputes: '/api/v1/disputes',
        export: '/api/v1/export/orders/:id'
      }
    },
    message: '欢迎使用二手电子产品验货担保交易 API'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '请求的资源不存在'
    }
  });
});

app.use(errorHandler);

module.exports = app;
