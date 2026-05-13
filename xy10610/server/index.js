const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/database');

const PORT = process.env.PORT || 3001;

const packagesRouter = require('./routes/packages');
const taxRouter = require('./routes/tax');
const customsRouter = require('./routes/customs');
const ticketsRouter = require('./routes/tickets');
const resubmitRouter = require('./routes/resubmit');
const exportRouter = require('./routes/export');
const importRouter = require('./routes/import');
const idempotencyMiddleware = require('./middleware/idempotency');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(idempotencyMiddleware);

app.use('/api/packages', packagesRouter);
app.use('/api/tax', taxRouter);
app.use('/api/customs', customsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/resubmit', resubmitRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);

app.use(express.static(path.join(__dirname, '../client/build')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();
