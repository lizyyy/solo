import express from 'express';
import * as services from './services';
import { QueryParams } from './types';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/statistics', async (req, res) => {
  try {
    const stats = await services.getStatistics();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sla-rules', async (req, res) => {
  try {
    const rules = await services.getSLARules();
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/callback-targets', async (req, res) => {
  try {
    const targets = await services.getCallbackTargets();
    res.json(targets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/events', async (req, res) => {
  try {
    const event = await services.createTimeoutEvent(req.body);
    res.status(201).json(event);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.get('/events', async (req, res) => {
  try {
    const params: QueryParams = {
      status: req.query.status as any,
      ticketId: req.query.ticketId as string,
      startTime: req.query.startTime as string,
      endTime: req.query.endTime as string,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20
    };
    const result = await services.getTimeoutEvents(params);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/events/:id', async (req, res) => {
  try {
    const event = await services.getTimeoutEvent(req.params.id);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json(event);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/events/:id/responses', async (req, res) => {
  try {
    const summaries = await services.getResponseSummaries(req.params.id);
    res.json(summaries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/events/:id/retry', async (req, res) => {
  try {
    const batch = await services.createManualRetry({
      eventIds: [req.params.id],
      reason: req.body.reason || 'Manual retry',
      triggeredBy: req.body.triggeredBy || 'admin'
    });
    res.json(batch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/retry-batches', async (req, res) => {
  try {
    const batch = await services.createManualRetry(req.body);
    res.status(201).json(batch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/retry-batches', async (req, res) => {
  try {
    const batches = await services.getRetryBatches();
    res.json(batches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/events', async (req, res) => {
  try {
    const params: QueryParams = {
      status: req.query.status as any,
      ticketId: req.query.ticketId as string,
      startTime: req.query.startTime as string,
      endTime: req.query.endTime as string
    };
    const csv = await services.exportEvents(params);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sla-events-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
