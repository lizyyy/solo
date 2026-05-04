import { Router, Request, Response } from 'express';
import { db } from '../database.js';
import { ObservationActivity } from '../types.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const activities = db
      .prepare('SELECT * FROM observation_activities ORDER BY date DESC')
      .all() as ObservationActivity[];
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const activity = db
      .prepare('SELECT * FROM observation_activities WHERE id = ?')
      .get(req.params.id) as ObservationActivity | undefined;

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, date, siteId, status } = req.body;
    const now = new Date().toISOString();
    const id = `activity_${crypto.randomUUID()}`;

    db
      .prepare(`
        INSERT INTO observation_activities (id, name, date, site_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(id, name, date, siteId, status || 'planned', now, now);

    const activity = db
      .prepare('SELECT * FROM observation_activities WHERE id = ?')
      .get(id) as ObservationActivity;

    res.status(201).json(activity);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { name, date, siteId, status } = req.body;
    const now = new Date().toISOString();

    const result = db
      .prepare(`
        UPDATE observation_activities
        SET name = ?, date = ?, site_id = ?, status = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(name, date, siteId, status, now, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const activity = db
      .prepare('SELECT * FROM observation_activities WHERE id = ?')
      .get(req.params.id) as ObservationActivity;

    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = db
      .prepare('DELETE FROM observation_activities WHERE id = ?')
      .run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

export default router;
