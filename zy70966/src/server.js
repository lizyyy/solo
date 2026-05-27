const express = require('express');
const pino = require('pino-http');
const config = require('./config');
require('./db');

const importRoutes = require('./routes/imports');
const qaRoutes = require('./routes/qa');
const reportRoutes = require('./routes/reports');

const app = express();
app.use(pino({ level: config.logLevel }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ code: 0, data: { status: 'ok', time: new Date().toISOString() } });
});

app.use('/api/imports', importRoutes);
app.use('/api', qaRoutes);
app.use('/api/reports', reportRoutes);

app.use((err, req, res, next) => {
  req.log.error(err);
  res.status(err.status || 500).json({ code: 1, error: err.message || 'internal error' });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`[qa-reconcile] server running on http://localhost:${config.port}`);
    console.log(`[qa-reconcile] health check: GET http://localhost:${config.port}/health`);
    console.log(`[qa-reconcile] api prefix: /api/*`);
  });
}

module.exports = app;
