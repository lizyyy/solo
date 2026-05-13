const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../client')));

const db = require('./database/db');
const tenantRoutes = require('./routes/tenants');
const contractRoutes = require('./routes/contracts');
const meterRoutes = require('./routes/meterReadings');
const deviceRoutes = require('./routes/devices');
const billRoutes = require('./routes/bills');
const adjustmentRoutes = require('./routes/adjustments');
const auditRoutes = require('./routes/audit');
const reportRoutes = require('./routes/reports');
const importRoutes = require('./routes/import');

app.use('/api/tenants', tenantRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/meter-readings', meterRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/adjustments', adjustmentRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/import', importRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
