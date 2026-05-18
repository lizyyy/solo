const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

const db = require('./database');
const rebateRoutes = require('./routes/rebate');

app.use('/api/rebate', rebateRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '酒类经销商酒水返利核算 API 运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    error: err.message || '服务器内部错误',
    code: err.code || 'INTERNAL_ERROR'
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`酒类经销商酒水返利核算 API 运行在 http://localhost:${port}`);
  });
}

module.exports = app;
