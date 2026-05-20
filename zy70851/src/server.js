const express = require('express');
const path = require('path');
const fs = require('fs');

require('./db');

const batchesRouter = require('./routes/batches');
const claimsRouter = require('./routes/claims');
const precheckRouter = require('./routes/precheck');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, '../uploads');
const reportsDir = path.join(__dirname, '../reports');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.use('/api/batches', batchesRouter);
app.use('/api/claims', claimsRouter);
app.use('/api/precheck', precheckRouter);
app.use('/api/reports', reportsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || '内部服务器错误',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

app.listen(PORT, () => {
  console.log(`保险理赔材料预审服务已启动: http://localhost:${PORT}`);
});
