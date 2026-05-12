const express = require('express');
const config = require('./config');
const db = require('./database');
const events = require('./events');

async function startServer() {
  await db.initDatabase();
  
  const app = express();

  app.use((req, res, next) => {
    req.rawBody = '';
    req.setEncoding('utf8');

    req.on('data', (chunk) => {
      req.rawBody += chunk;
    });

    req.on('end', () => {
      try {
        req.body = JSON.parse(req.rawBody);
      } catch (e) {
        req.body = {};
      }
      next();
    });
  });

  app.post('/webhook', async (req, res) => {
    const result = await events.receiveWebhook(req);
    res.status(result.httpStatus).json(result);
  });

  app.get('/events', (req, res) => {
    const filters = {
      status: req.query.status,
      event_type: req.query.event_type,
      provider: req.query.provider
    };
    const result = events.listEvents(filters);
    res.json(result);
  });

  app.get('/events/:eventId', (req, res) => {
    const result = events.getEventById(req.params.eventId);
    if (!result) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(result);
  });

  app.post('/events/:eventId/replay', async (req, res) => {
    const mode = req.body.mode || 'full';
    const actor = req.body.actor || 'api';
    
    const validModes = ['full', 'verify_signature_only', 'business_only'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` });
    }
    
    const result = await events.replayEvent(req.params.eventId, mode, actor);
    res.status(result.httpStatus).json(result);
  });

  app.post('/events/:eventId/disable-replay', (req, res) => {
    const reason = req.body.reason || 'Manually disabled';
    const actor = req.body.actor || 'api';
    const result = events.disableReplay(req.params.eventId, reason, actor);
    res.status(result.httpStatus).json(result);
  });

  app.post('/events/:eventId/confirm', (req, res) => {
    const actor = req.body.actor || 'api';
    const result = events.confirmCompleted(req.params.eventId, actor);
    res.status(result.httpStatus).json(result);
  });

  app.post('/events/:eventId/unconfirm', (req, res) => {
    const actor = req.body.actor || 'api';
    const result = events.unconfirmCompleted(req.params.eventId, actor);
    res.status(result.httpStatus).json(result);
  });

  app.listen(config.PORT, () => {
    console.log(`Webhook Replay System running on http://localhost:${config.PORT}`);
    console.log(`Secret: ${config.SIGNATURE_SECRET}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
