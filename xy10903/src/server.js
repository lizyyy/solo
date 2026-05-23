const express = require('express');
const bodyParser = require('body-parser');

require('./database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: '校园借书预约 API',
    version: '1.0.0',
    endpoints: {
      bookings: {
        create: 'POST /api/bookings',
        list: 'GET /api/bookings',
        get: 'GET /api/bookings/:id',
        lock: 'POST /api/bookings/lock-next',
        fulfill: 'POST /api/bookings/:id/fulfill',
        cancel: 'POST /api/bookings/:id/cancel',
        manual: 'PATCH /api/bookings/:id/manual'
      },
      books: {
        list: 'GET /api/books',
        get: 'GET /api/books/:id',
        queue: 'GET /api/books/:id/queue'
      },
      readers: {
        list: 'GET /api/readers',
        get: 'GET /api/readers/:id'
      },
      reports: {
        circulation: 'GET /api/reports/circulation'
      },
      export: {
        circulation: 'GET /api/export/circulation'
      },
      overdue: {
        check: 'POST /api/overdue/check'
      },
      health: 'GET /api/health'
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`
  ================================================
    校园借书预约 API 服务已启动
    本地地址: http://localhost:${PORT}
    API 前缀: http://localhost:${PORT}/api
    启动时间: ${new Date().toLocaleString('zh-CN')}
  ================================================
  `);
});

module.exports = app;
