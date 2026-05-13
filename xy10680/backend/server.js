const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const db = require('./database');
require('./models/init')(db);

const employeeRoutes = require('./routes/employees');
const batchRoutes = require('./routes/batches');
const exchangeRoutes = require('./routes/exchanges');
const recoveryRoutes = require('./routes/recoveries');
const inventoryRoutes = require('./routes/inventory');
const timelineRoutes = require('./routes/timeline');
const importRoutes = require('./routes/import');
const exportRoutes = require('./routes/export');
const demoRoutes = require('./routes/demo');

app.use('/api/employees', employeeRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/recoveries', recoveryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/demo', demoRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;