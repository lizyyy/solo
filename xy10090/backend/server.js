const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./database');
const invoicesRouter = require('./routes/invoices');
const reportsRouter = require('./routes/reports');
const importExportRouter = require('./routes/import-export');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/invoices', invoicesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/import-export', importExportRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`票据复核台服务已启动: http://localhost:${PORT}`);
    console.log(`API 健康检查: http://localhost:${PORT}/api/health`);
  });
});
