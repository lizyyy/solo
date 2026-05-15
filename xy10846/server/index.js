const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const requestLogger = require('./middleware/requestLogger');
app.use(requestLogger);

app.use(express.static(path.join(__dirname, '../public')));

const db = require('./database/connection');
require('./database/init')();

const documentsRouter = require('./routes/documents');
const rulesRouter = require('./routes/rules');
const previewsRouter = require('./routes/previews');
const versionsRouter = require('./routes/versions');
const exportRouter = require('./routes/export');

app.use('/api/documents', documentsRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/previews', previewsRouter);
app.use('/api/versions', versionsRouter);
app.use('/api/export', exportRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  文档切片策略台 启动成功!`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  API文档: http://localhost:${PORT}/api/health`);
  console.log(`========================================\n`);
});

module.exports = app;
