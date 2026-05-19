const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('./models/database');

const batchRoutes = require('./routes/batches');
const recordRoutes = require('./routes/records');
const importRoutes = require('./routes/import');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Port Scheduling Service is running' });
});

app.use('/api/batches', batchRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Port Scheduling Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
