const express = require('express');
const cors = require('cors');
const config = require('./config');
const initDatabase = require('./database/init');
const { maskSensitiveFields } = require('./utils/security');

const importRoutes = require('./routes/importRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const billingRoutes = require('./routes/billingRoutes');
const logRoutes = require('./routes/logRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    if (data && data.data) {
      data.data = maskSensitiveFields(data.data);
    }
    return originalJson.call(this, data);
  };
  next();
});

app.get('/', (req, res) => {
  res.json({
    message: '农机合作社财务管理系统 API',
    version: '1.0.0',
    endpoints: {
      import: '/api/import',
      review: '/api/review',
      billing: '/api/billing',
      logs: '/api/logs'
    }
  });
});

app.use('/api/import', importRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/logs', logRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

const startServer = async () => {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(config.port, () => {
      console.log(`服务器运行在 http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
