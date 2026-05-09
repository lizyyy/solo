const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

const ordersRoute = require('./routes/orders');
const anomaliesRoute = require('./routes/anomalies');
const importExportRoute = require('./routes/importExport');

app.use('/api/orders', ordersRoute);
app.use('/api/anomalies', anomaliesRoute);
app.use('/api', importExportRoute);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`返工单质量闭环台 - 后端服务已启动，端口: ${PORT}`);
});
