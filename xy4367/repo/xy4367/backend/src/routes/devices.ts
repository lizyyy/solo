import { Router, Request, Response } from 'express';
import { db } from '../database.js';
import { Device } from '../types.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const devices = db
      .prepare('SELECT * FROM devices ORDER BY type, name')
      .all() as Device[];
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const device = db
      .prepare('SELECT * FROM devices WHERE id = ?')
      .get(req.params.id) as Device | undefined;

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, type, model, batteryLevel, isAvailable, description } = req.body;
    const id = `device_${crypto.randomUUID()}`;

    db
      .prepare(`
        INSERT INTO devices (id, name, type, model, battery_level, is_available, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(id, name, type, model, batteryLevel ?? 100, isAvailable ?? true, description);

    const device = db
      .prepare('SELECT * FROM devices WHERE id = ?')
      .get(id) as Device;

    res.status(201).json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create device' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { name, type, model, batteryLevel, isAvailable, description } = req.body;

    const result = db
      .prepare(`
        UPDATE devices
        SET name = ?, type = ?, model = ?, battery_level = ?, is_available = ?, description = ?
        WHERE id = ?
      `)
      .run(name, type, model, batteryLevel, isAvailable, description, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const device = db
      .prepare('SELECT * FROM devices WHERE id = ?')
      .get(req.params.id) as Device;

    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update device' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = db
      .prepare('DELETE FROM devices WHERE id = ?')
      .run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

export default router;
