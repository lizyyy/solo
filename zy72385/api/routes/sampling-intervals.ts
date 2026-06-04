import { Router, Request, Response } from 'express';
import { getSamplingIntervals, createSamplingInterval } from '../services/cavitationService.js';
import { recordChange } from '../services/auditService.js';
import { db, saveDb } from '../data/db.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const intervals = await getSamplingIntervals();
    res.json(intervals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sampling intervals' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { pumpId, startTime, endTime, intervalMinutes, description, creator } = req.body;
    const interval = await createSamplingInterval(
      { pumpId, startTime, endTime, intervalMinutes, description, creator: creator || 'user-1' },
      creator || 'user-1'
    );
    res.json(interval);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create sampling interval' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { updates, changedBy, changeReason } = req.body;

    await db.read();
    const interval = db.data.samplingIntervals.find((i) => i.id === id);
    if (!interval) {
      res.status(404).json({ error: 'Sampling interval not found' });
      return;
    }

    const oldValues: Record<string, any> = {};

    for (const key of Object.keys(updates)) {
      const k = key as keyof typeof interval;
      if (updates[k] !== undefined && updates[k] !== interval[k]) {
        oldValues[key] = interval[k];
        (interval as any)[k] = updates[k];
      }
    }

    interval.updateTime = new Date().toISOString();
    interval.version += 1;

    for (const [field, oldVal] of Object.entries(oldValues)) {
      await recordChange(
        'sampling_interval',
        id,
        field,
        oldVal,
        (updates as any)[field],
        changeReason || '更新采样间隔',
        changedBy || 'user-1',
        interval.calculationIds
      );
    }

    await saveDb();
    res.json(interval);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update sampling interval' });
  }
});

export default router;
