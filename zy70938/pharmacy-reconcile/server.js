'use strict';

const express = require('express');
const path = require('path');

const routes = require('./routes/reconcile');
const { loadAll } = require('./data/loader');
const { AppError, wrap } = require('./middleware/errors');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

const app = express();
app.use(express.json({ limit: '1mb' }));

// 全局上下文：数据、状态、服务
app.use((req, _res, next) => {
  req.ctx = { dataDir: DATA_DIR };
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'pharmacy-reconcile' });
});

app.use('/api/reconcile', routes);

// 404
app.use((req, _res, next) => {
  next(new AppError(`未找到路由: ${req.method} ${req.path}`, 404));
});

// 错误处理
app.use((err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  // multer / body 等错误
  if (err && (err.type === 'entity.parse.failed' || err.status === 400)) {
    return res.status(400).json({ error: '请求体格式错误' });
  }
  console.error('[Unhandled]', err && err.stack ? err.stack : err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动前加载样例数据到内存
loadAll(DATA_DIR).then((store) => {
  app.set('store', store);
  app.listen(PORT, () => {
    console.log(`pharmacy-reconcile listening on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});

module.exports = app;
