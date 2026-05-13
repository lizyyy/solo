const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const idempotencyMiddleware = require('./middleware/idempotency');
const contentItemsRouter = require('./routes/contentItems');
const rightsHoldersRouter = require('./routes/rightsHolders');
const complaintsRouter = require('./routes/complaints');
const appealsRouter = require('./routes/appeals');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3001;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(bodyParser.json());
app.use(idempotencyMiddleware);

app.use('/api/content-items', contentItemsRouter);
app.use('/api/rights-holders', rightsHoldersRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/appeals', appealsRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务运行正常', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`内容侵权投诉申诉系统后端服务运行在 http://localhost:${PORT}`);
  console.log(`数据库文件位置: ${path.join(dataDir, 'complaints.db')}`);
});
