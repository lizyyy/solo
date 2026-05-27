const express = require('express');
const config = require('./config');
const { getDb } = require('./src/db/connection');
const { initSchema } = require('./src/db/schema');
const { extractOperator } = require('./src/middleware/operator');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(extractOperator);

app.use('/api/batches', require('./src/routes/batches'));
app.use('/api/artifacts', require('./src/routes/artifacts'));
app.use('/api/exceptions', require('./src/routes/exceptions'));
app.use('/api/import', require('./src/routes/import'));
app.use('/api/audit', require('./src/routes/audit'));
app.use('/api/exports', require('./src/routes/exports'));

app.get('/api', (req, res) => {
  res.json({
    service: '博物馆展陈部文物追踪服务',
    version: '1.0.0',
    endpoints: {
      batches: '/api/batches',
      artifacts: '/api/artifacts',
      exceptions: '/api/exceptions',
      import: '/api/import',
      audit: '/api/audit',
      exports: '/api/exports'
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: err.message, message: '服务器内部错误' });
});

async function start() {
  try {
    const db = getDb(config.dbPath);
    await initSchema(db);
    console.log('数据库初始化完成');

    app.listen(config.port, () => {
      console.log(`博物馆文物追踪服务已启动: http://localhost:${config.port}`);
      console.log(`API 入口: http://localhost:${config.port}/api`);
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

start();
