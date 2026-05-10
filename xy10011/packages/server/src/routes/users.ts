import { Router, Request, Response } from 'express';
import { userService } from '../services/user-service';

const router = Router();

router.post('/get-or-create', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || req.body.userId;
    const clientId = req.headers['x-client-id'] as string || 'unknown';

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await userService.getOrCreateUser(
      userId,
      {
        name: req.body.name,
        avatar: req.body.avatar,
      },
      clientId,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: req.headers['x-correlation-id'] as string,
      }
    );

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const clientId = req.headers['x-client-id'] as string || 'unknown';

    const user = await userService.createUser(
      req.body,
      clientId,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: req.headers['x-correlation-id'] as string,
      }
    );

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const expectedVersion = parseInt(req.headers['if-match'] as string || '0', 10);
    const clientId = req.headers['x-client-id'] as string || 'unknown';

    const user = await userService.updateUser(
      req.params.id,
      req.body,
      clientId,
      expectedVersion,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: req.headers['x-correlation-id'] as string,
      }
    );

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = userService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const users = userService.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
