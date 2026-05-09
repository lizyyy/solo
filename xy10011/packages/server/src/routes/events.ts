import { Router, Request, Response } from 'express';
import { eventStore } from '../event-store';
import { conflictService } from '../services/conflict-service';
import { syncService } from '../services/sync-service';

const router = Router();

router.get('/aggregate/:id', async (req: Request, res: Response) => {
  try {
    const events = eventStore.getEventsByAggregate(req.params.id);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '100', 10);
    const events = eventStore.getEventsByUser(req.params.userId, limit);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/sync', async (req: Request, res: Response) => {
  try {
    const clientId = req.headers['x-client-id'] as string || 'unknown';
    const result = await syncService.sync(
      clientId,
      req.body.localEvents || [],
      req.body.lastKnownServerVersion || 0
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/sync/state', async (req: Request, res: Response) => {
  try {
    const state = syncService.getSyncState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/replay/:aggregateId', async (req: Request, res: Response) => {
  try {
    const targetVersion = parseInt(req.body.targetVersion, 10);
    const success = await syncService.replayEvents(req.params.aggregateId, targetVersion);
    res.json({ success, targetVersion });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/conflicts', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '100', 10);
    const conflicts = conflictService.getPendingConflicts(limit);
    res.json(conflicts);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/conflicts/:id/resolve', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'anonymous';
    const conflict = await conflictService.resolveConflict(
      req.params.id,
      req.body.resolution,
      userId
    );
    res.json(conflict);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
