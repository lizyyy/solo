const express = require('express');
const cors = require('cors');
const config = require('./config');
const { createTables } = require('./db/schema');
const { init } = require('./db');
const { processPendingRetries } = require('./services/eventService');

const providersRouter = require('./routes/providers');
const eventsRouter = require('./routes/events');
const webhookRouter = require('./routes/webhook');
const exportRouter = require('./routes/export');

const app = express();

app.use(cors());

app.use((req, res, next) => {
  let chunks = [];
  req.on('data', (chunk) => {
    chunks.push(chunk);
  });
  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks).toString('utf8');
    try {
      req.body = JSON.parse(req.rawBody);
    } catch (e) {
      req.body = {};
    }
    next();
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

app.use('/api/providers', providersRouter);
app.use('/api/events', eventsRouter);
app.use('/api/export', exportRouter);
app.use('/webhook', webhookRouter);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
  });
});

function startRetryScheduler() {
  const interval = (config.retry.scheduleInterval || 60) * 1000;
  
  setInterval(async () => {
    try {
      console.log('[Retry Scheduler] Checking for pending retries...');
      const results = await processPendingRetries();
      if (results.length > 0) {
        console.log(`[Retry Scheduler] Processed ${results.length} retry events`);
      }
    } catch (err) {
      console.error('[Retry Scheduler] Error:', err);
    }
  }, interval);
  
  console.log(`[Retry Scheduler] Started with interval ${config.retry.scheduleInterval || 60}s`);
}

async function startServer() {
  console.log('[Startup] Initializing database...');
  
  return new Promise((resolve, reject) => {
    init(async (err) => {
      if (err) {
        console.error('[Startup] Database initialization failed:', err);
        reject(err);
        return;
      }
      
      try {
        await createTables();
        console.log('[Startup] Database initialized');
        
        app.listen(config.port, () => {
          console.log(`[Startup] Webhook Debugger Server running on http://localhost:${config.port}`);
          console.log('[Startup] Routes:');
          console.log(`  GET  /health                          - Health check`);
          console.log(`  GET  /api/providers                   - List providers`);
          console.log(`  POST /api/providers                   - Create provider`);
          console.log(`  GET  /api/events                      - List events`);
          console.log(`  POST /api/events/:id/replay           - Replay event`);
          console.log(`  GET  /api/export?format=json          - Export report (json/csv/md)`);
          console.log(`  POST /webhook/:providerName           - Receive webhook`);
          console.log('');
          console.log('[Startup] Retry scheduler will start shortly...');
          
          setTimeout(startRetryScheduler, 2000);
          resolve();
        });
      } catch (tableErr) {
        console.error('[Startup] Failed to create tables:', tableErr);
        reject(tableErr);
      }
    });
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
