const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initDatabase } = require('./models/database');

const batchesRoute = require('./routes/batches');
const samplesRoute = require('./routes/samples');
const importRoute = require('./routes/import');
const exportRoute = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/batches', batchesRoute);
app.use('/api/samples', samplesRoute);
app.use('/api/import', importRoute);
app.use('/api/export', exportRoute);

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Inspection Sample Service is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Inspection Sample Service API',
    endpoints: {
      'GET /api/health': 'Health check',
      'GET /api/batches': 'Get all batches',
      'POST /api/batches': 'Create new batch',
      'GET /api/batches/:id': 'Get batch details',
      'POST /api/batches/:id/process': 'Mark batch as processed',
      'POST /api/batches/:id/return': 'Return batch for revision',
      'POST /api/batches/:id/withdraw': 'Withdraw batch',
      'GET /api/batches/:id/export': 'Export batch details',
      'GET /api/samples': 'Query samples with filters',
      'POST /api/import/samples': 'Import samples CSV',
      'POST /api/import/test-items': 'Import test items JSON',
      'POST /api/import/recheck-rules': 'Import recheck rules JSON'
    }
  });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized successfully');
    
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`API docs: http://localhost:${PORT}/api`);
    });
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
}

startServer();

module.exports = app;
