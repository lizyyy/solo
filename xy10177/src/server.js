const express = require('express');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const { startCallbackRetryScheduler } = require('./services/callbackService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const resourcesRouter = require('./routes/resources');
const meetingsRouter = require('./routes/meetings');
const transactionsRouter = require('./routes/transactions');

app.use('/api/resources', resourcesRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/transactions', transactionsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Meeting Room Conflict API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('');
  
  if (process.env.DISABLE_CALLBACK_SCHEDULER !== 'true') {
    startCallbackRetryScheduler(60000);
    console.log('[Scheduler] Callback retry scheduler started (60s interval)');
    console.log('');
  }
  
  console.log('Available endpoints:');
  console.log('  GET  /api/resources/rooms');
  console.log('  POST /api/resources/rooms');
  console.log('  GET  /api/resources/rooms/:id');
  console.log('  GET  /api/resources/rooms/:id/availability');
  console.log('  GET  /api/resources/devices');
  console.log('  POST /api/resources/devices');
  console.log('  GET  /api/resources/devices/:id');
  console.log('  GET  /api/resources/devices/:id/availability');
  console.log('  GET  /api/resources/catering');
  console.log('  POST /api/resources/catering');
  console.log('  GET  /api/resources/catering/:id');
  console.log('  GET  /api/resources/catering/:id/availability');
  console.log('');
  console.log('  GET  /api/meetings');
  console.log('  POST /api/meetings');
  console.log('  POST /api/meetings/book');
  console.log('  GET  /api/meetings/calendar');
  console.log('  GET  /api/meetings/:id');
  console.log('  GET  /api/meetings/:id/bookings');
  console.log('  GET  /api/meetings/:id/history');
  console.log('  GET  /api/meetings/:id/check-reschedule');
  console.log('  POST /api/meetings/:id/reschedule');
  console.log('  POST /api/meetings/:id/cancel');
  console.log('  GET  /api/meetings/:id/calendar');
  console.log('');
  console.log('  GET  /api/transactions');
  console.log('  GET  /api/transactions/:id');
  console.log('');
});

module.exports = app;
