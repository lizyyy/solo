import { Router, Request, Response } from 'express';
import { db } from '../data/db.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    await db.read();
    res.json(db.data.users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    await db.read();
    const user = db.data.users.find((u) => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  try {
    await db.read();
    const user = db.data.users[0];
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

export default router;
