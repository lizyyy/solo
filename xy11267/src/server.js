const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const recordsRouter = require('./routes/records');
const rulesRouter = require('./routes/rules');
const auditRouter = require('./routes/audit');
const exportsRouter = require('./routes/exports');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/records', recordsRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/audit', auditRouter);
app.use('/api/exports', exportsRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务运行正常', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  logger.error('未处理的错误', { error: err.message, stack: err.stack });
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  logger.info(`客服质检系统启动成功，端口: ${PORT}`);
  console.log(`服务运行在 http://localhost:${PORT}`);
});

module.exports = app;
