const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

require('./database/db');

const skuRoutes = require('./routes/skuRoutes');
const shiftUsageRoutes = require('./routes/shiftUsageRoutes');
const areaRoutes = require('./routes/areaRoutes');
const returnInspectionRoutes = require('./routes/returnInspectionRoutes');
const replenishmentAlertRoutes = require('./routes/replenishmentAlertRoutes');
const costVarianceRoutes = require('./routes/costVarianceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const logRoutes = require('./routes/logRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/sku', skuRoutes);
app.use('/api/shift-usage', shiftUsageRoutes);
app.use('/api/area', areaRoutes);
app.use('/api/return-inspection', returnInspectionRoutes);
app.use('/api/replenishment-alert', replenishmentAlertRoutes);
app.use('/api/cost-variance', costVarianceRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/logs', logRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '服务器运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});