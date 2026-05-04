const express = require('express');
const router = express.Router();
const {
  getEventById,
  listEvents,
  updateEventStatus,
} = require('../dao/eventDao');
const {
  getAttemptsByEventId,
  getLatestAttemptByEventId,
} = require('../dao/attemptDao');
const {
  getEventWithAttempts,
  replayEvent,
  processEvent,
  getStatistics,
} = require('../services/eventService');
const { getProviderById } = require('../dao/providerDao');
const { createAuditLog, ACTIONS } = require('../dao/auditDao');
const { EVENT_STATUSES } = require('../db/schema');

router.get('/', async (req, res) => {
  try {
    const filters = {};
    
    if (req.query.provider_name) filters.provider_name = req.query.provider_name;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.event_id) filters.event_id = req.query.event_id;
    if (req.query.since) filters.since = parseInt(req.query.since);
    if (req.query.until) filters.until = parseInt(req.query.until);
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    
    const events = await listEvents(filters);
    res.json({
      success: true,
      data: events,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const since = req.query.since ? parseInt(req.query.since) : null;
    const until = req.query.until ? parseInt(req.query.until) : null;
    
    const stats = await getStatistics(since, until);
    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const event = await getEventWithAttempts(parseInt(req.params.id));
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
      });
    }
    
    res.json({
      success: true,
      data: event,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.get('/:id/attempts', async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const event = await getEventById(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
      });
    }
    
    const attempts = await getAttemptsByEventId(eventId);
    res.json({
      success: true,
      data: attempts,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.post('/:id/replay', async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const event = await getEventById(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
      });
    }
    
    const provider = await getProviderById(event.provider_id);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider not found for this event',
      });
    }
    
    await createAuditLog(
      ACTIONS.EVENT_REPLAYED,
      'event',
      eventId,
      { manual: true }
    );
    
    const result = await replayEvent(event, provider);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.post('/batch/replay', async (req, res) => {
  try {
    const { provider_name, statuses } = req.body;
    
    const filters = {};
    if (provider_name) filters.provider_name = provider_name;
    
    const targetStatuses = statuses || [EVENT_STATUSES.FAILED_RETRY, EVENT_STATUSES.DISCARDED];
    
    filters.status = EVENT_STATUSES.FAILED_RETRY;
    let eventsToReplay = await listEvents(filters);
    
    if (targetStatuses.includes(EVENT_STATUSES.DISCARDED)) {
      filters.status = EVENT_STATUSES.DISCARDED;
      const discarded = await listEvents(filters);
      eventsToReplay = [...eventsToReplay, ...discarded];
    }
    
    if (eventsToReplay.length === 0) {
      return res.json({
        success: true,
        message: 'No events to replay',
        replayed: 0,
      });
    }
    
    await createAuditLog(
      ACTIONS.BATCH_REPLAY_STARTED,
      'event',
      null,
      { 
        count: eventsToReplay.length,
        provider_name,
        statuses: targetStatuses,
      }
    );
    
    const results = [];
    
    for (const event of eventsToReplay) {
      try {
        const provider = await getProviderById(event.provider_id);
        if (provider) {
          const result = await replayEvent(event, provider);
          results.push({
            eventId: event.id,
            ...result,
          });
        }
      } catch (err) {
        results.push({
          eventId: event.id,
          success: false,
          error: err.message,
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    res.json({
      success: true,
      data: {
        total: eventsToReplay.length,
        success: successCount,
        failed: failCount,
        results,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

module.exports = router;
