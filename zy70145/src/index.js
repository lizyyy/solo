const express = require('express');
const config = require('./config');
const db = require('./db');
const logger = require('./services/logger');

const middleware = require('./routes/middleware');
const ownersRouter = require('./routes/owners');
const slowQueriesRouter = require('./routes/slowQueries');
const fingerprintsRouter = require('./routes/fingerprints');
const optimizationsRouter = require('./routes/optimizations');
const reportsRouter = require('./routes/reports');
const operationsRouter = require('./routes/operations');

const app = express();

app.use(express.json());
app.use(middleware.requestLogger);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: Date.now()
  });
});

app.use('/api/owners', ownersRouter);
app.use('/api/slow-queries', slowQueriesRouter);
app.use('/api/fingerprints', fingerprintsRouter);
app.use('/api/optimizations', optimizationsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/operations', operationsRouter);

app.get('/api', (req, res) => {
  res.json({
    success: true,
    version: '1.0.0',
    endpoints: {
      owners: '/api/owners',
      ingest: '/api/slow-queries/ingest',
      fingerprints: '/api/fingerprints',
      optimizations: '/api/optimizations',
      reports: '/api/reports/weekly',
      operations: {
        exceptions: '/api/operations/exceptions',
        tasks: '/api/operations/tasks'
      }
    }
  });
});

app.use(middleware.notFoundHandler);
app.use(middleware.errorHandler);

function start() {
  try {
    db.init();
    logger.info('Database initialized');
    
    app.listen(config.server.port, config.server.host, () => {
      logger.info(`Slow Query Tracker API running on ${config.server.host}:${config.server.port}`);
      logger.info('Available endpoints:');
      logger.info('  GET  /health');
      logger.info('  GET  /api');
      logger.info('  POST /api/slow-queries/ingest');
      logger.info('  POST /api/slow-queries/ingest/batch');
      logger.info('  GET  /api/fingerprints');
      logger.info('  GET  /api/fingerprints/:id');
      logger.info('  POST /api/fingerprints/:id/claim');
      logger.info('  POST /api/fingerprints/:id/optimize');
      logger.info('  POST /api/optimizations/:id/reruns');
      logger.info('  GET  /api/reports/weekly');
      logger.info('  GET  /api/operations/exceptions');
      logger.info('  GET  /api/operations/tasks');
    });
  } catch (e) {
    logger.error('Failed to start server', { error: e.message });
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;
