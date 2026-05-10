const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const { initDatabase } = require('./db/connection');

const requestsRoutes = require('./routes/requests');
const reviewsRoutes = require('./routes/reviews');
const executionsRoutes = require('./routes/executions');
const auditRoutes = require('./routes/audit');
const statisticsRoutes = require('./routes/statistics');
const exportsRoutes = require('./routes/exports');

const app = express();

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'data-repair-ticket-service',
    version: '1.0.0',
    timestamp: Date.now()
  });
});

app.use('/api/requests', requestsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/executions', executionsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/exports', exportsRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

async function startServer() {
  try {
    console.log('Initializing database...');
    await initDatabase();
    console.log('Database initialized successfully.');

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Health check: http://localhost:${config.port}/api/health`);
      console.log('');
      console.log('Available API endpoints:');
      console.log('  GET    /api/health                          - Health check');
      console.log('');
      console.log('  POST   /api/requests                        - Create repair request');
      console.log('  GET    /api/requests                        - List requests');
      console.log('  GET    /api/requests/:id                    - Get request detail');
      console.log('  PUT    /api/requests/:id                    - Update request');
      console.log('  POST   /api/requests/:id/submit-review      - Submit for review');
      console.log('  POST   /api/requests/:id/manual-status      - Manual status correction');
      console.log('');
      console.log('  POST   /api/reviews/:request_id             - Create review');
      console.log('  GET    /api/reviews/:request_id             - Get reviews by request');
      console.log('  GET    /api/reviews                         - Get pending reviews');
      console.log('');
      console.log('  POST   /api/executions/:request_id/start           - Start execution');
      console.log('  POST   /api/executions/:request_id/complete        - Complete execution');
      console.log('  GET    /api/executions/:request_id/history         - Get execution history');
      console.log('  POST   /api/executions/:request_id/rollback-request - Request rollback');
      console.log('  POST   /api/executions/:request_id/execute-rollback - Execute rollback');
      console.log('  POST   /api/executions/:request_id/rollback-scripts - Add rollback script');
      console.log('  GET    /api/executions/:request_id/rollback-scripts - Get rollback scripts');
      console.log('');
      console.log('  POST   /api/audit/:request_id               - Generate audit report');
      console.log('  GET    /api/audit/:request_id               - List audit reports');
      console.log('  GET    /api/audit/report/:id                - Get audit report detail');
      console.log('');
      console.log('  GET    /api/statistics/status               - Status statistics');
      console.log('  GET    /api/statistics/status-historical    - Historical status statistics');
      console.log('  GET    /api/statistics/manual-corrections   - Manual corrections list');
      console.log('  GET    /api/statistics/execution            - Execution statistics');
      console.log('  GET    /api/statistics/department           - Department statistics');
      console.log('');
      console.log('  GET    /api/exports/requests                - Export requests (JSON/CSV)');
      console.log('  GET    /api/exports/requests/:id            - Export request detail');
      console.log('  GET    /api/exports/statistics              - Export statistics');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();