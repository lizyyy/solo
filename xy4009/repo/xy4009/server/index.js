const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
const uploadsDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const db = require('./db/database');
const { errorHandler } = require('./middleware/errorHandler');

const materialsRouter = require('./routes/materials');
const suppliersRouter = require('./routes/suppliers');
const exchangeRatesRouter = require('./routes/exchangeRates');
const quotationsRouter = require('./routes/quotations');
const csvImportExportRouter = require('./routes/csvImportExport');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/materials', materialsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/exchange-rates', exchangeRatesRouter);
app.use('/api/quotations', quotationsRouter);
app.use('/api/csv', csvImportExportRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务器运行正常', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

app.listen(PORT, () => {
  console.log(`供应商报价比价台账系统已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/api/health`);
});
