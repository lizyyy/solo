const express = require('express');
const bodyParser = require('body-parser');
const core = require('./core');
require('./database');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

const validateAlert = (req, res, next) => {
  const { source, title, service, severity } = req.body;
  
  if (!source || !title || !service || !severity) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['source', 'title', 'service', 'severity']
    });
  }
  
  const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
  if (!validSeverities.includes(severity)) {
    return res.status(400).json({
      error: 'Invalid severity',
      valid: validSeverities
    });
  }
  
  next();
};

app.post('/api/alerts', validateAlert, async (req, res) => {
  try {
    const alert = req.body;
    alert.fingerprint = core.calculateFingerprint(alert);
    
    const { event, isNew, isRecurrence } = await core.findMatchingEvent(
      alert.fingerprint, alert.service, alert
    );
    
    let eventId;
    let action = '';
    let notificationSent = false;
    
    if (isNew) {
      eventId = await core.createEvent(alert, alert.fingerprint);
      action = 'created';
      
      if (await core.shouldSendNotification(eventId)) {
        await core.createNotification(
          eventId, 'oncall', 'oncall-team',
          `新事件: ${alert.title} (${alert.severity})`
        );
        notificationSent = true;
      }
    } else {
      eventId = event.id;
      
      if (isRecurrence) {
        await core.updateEventForRecurrence(eventId, alert);
        action = 'reopened';
        
        if (await core.shouldSendNotification(eventId)) {
          await core.createNotification(
            eventId, 'oncall', 'oncall-team',
            `事件复发: ${alert.title} (${alert.severity})`
          );
          notificationSent = true;
        }
      } else {
        await core.updateEventWithAlert(eventId, alert);
        action = 'updated';
      }
      
      const currentEvent = await core.promisifyDbGet(
        'SELECT status, assignee FROM events WHERE id = ?',
        [eventId]
      );
      
      if (currentEvent && currentEvent.status === 'acknowledged') {
        await core.escalateEvent(
          eventId, currentEvent.assignee,
          '已确认事件收到新证据'
        );
        
        if (await core.shouldSendNotification(eventId)) {
          await core.createNotification(
            eventId, 'oncall', currentEvent.assignee,
            `已确认事件收到新证据: ${alert.title}`
          );
          notificationSent = true;
        }
      }
    }
    
    if (alert.affected_user_id) {
      await core.updateAffectedUsers(eventId, alert.affected_user_id, false);
    }
    
    await core.addAlert(alert, eventId);
    
    if (action === 'created' || isRecurrence) {
      await core.checkAndEscalate(eventId);
    }
    
    const eventDetails = await core.getEventWithDetails(eventId);
    
    res.json({
      success: true,
      action,
      is_new: isNew,
      is_recurrence: isRecurrence,
      event_id: eventId,
      fingerprint: alert.fingerprint,
      notification_sent: notificationSent,
      event: eventDetails.event
    });
  } catch (error) {
    console.error('Error processing alert:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.post('/api/events/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const { assignee } = req.body;
    
    if (!assignee) {
      return res.status(400).json({ error: 'assignee is required' });
    }
    
    const event = await core.promisifyDbGet('SELECT * FROM events WHERE id = ?', [id]);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    await core.acknowledgeEvent(id, assignee);
    
    const eventDetails = await core.getEventWithDetails(id);
    res.json({ success: true, event: eventDetails.event });
  } catch (error) {
    console.error('Error acknowledging event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/events/:id/escalate', async (req, res) => {
  try {
    const { id } = req.params;
    const { assignee, reason } = req.body;
    
    const event = await core.promisifyDbGet('SELECT * FROM events WHERE id = ?', [id]);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    await core.escalateEvent(id, assignee, reason || 'Manual escalation');
    
    const eventDetails = await core.getEventWithDetails(id);
    res.json({ success: true, event: eventDetails.event });
  } catch (error) {
    console.error('Error escalating event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/events/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, actor } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }
    
    const event = await core.promisifyDbGet('SELECT * FROM events WHERE id = ?', [id]);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    await core.closeEvent(id, reason, actor);
    
    const eventDetails = await core.getEventWithDetails(id);
    res.json({ success: true, event: eventDetails.event });
  } catch (error) {
    console.error('Error closing event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const { status } = req.query;
    const events = await core.listEvents(status);
    
    const eventsWithDetails = [];
    for (const event of events) {
      const details = await core.getEventWithDetails(event.id);
      eventsWithDetails.push(details);
    }
    
    res.json({ success: true, events: eventsWithDetails });
  } catch (error) {
    console.error('Error listing events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const details = await core.getEventWithDetails(id);
    
    if (!details) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const timelineForReview = details.timeline.map(entry => ({
      ...entry,
      metadata: JSON.parse(entry.metadata)
    }));
    
    res.json({
      success: true,
      main_event: details.event,
      related_alerts: details.alerts,
      notification_history: details.notifications,
      current_assignee: details.current_assignee,
      evidence_by_source: details.evidence_by_source,
      review_timeline: timelineForReview
    });
  } catch (error) {
    console.error('Error getting event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    config: {
      merge_same_service_different_metrics: core.config.mergeSameServiceDifferentMetrics,
      recurrence_window_minutes: core.config.recurrenceWindowMinutes,
      notification_throttle_minutes: core.config.notificationThrottleMinutes,
      auto_escalation_after_minutes: core.config.escalationAfterMinutes
    }
  });
});

app.listen(PORT, () => {
  console.log(`Alert deduplication API running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /api/alerts          - Ingest alert from any source');
  console.log('  GET  /api/events          - List all events');
  console.log('  GET  /api/events/:id      - Get event details with timeline');
  console.log('  POST /api/events/:id/acknowledge - Acknowledge event');
  console.log('  POST /api/events/:id/escalate    - Escalate event');
  console.log('  POST /api/events/:id/close       - Close event');
  console.log('  GET  /api/config          - Get current configuration');
});
