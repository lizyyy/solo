import { Router, Request, Response } from 'express';
import { groupService } from '../services/group-service';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'anonymous';
    const clientId = req.headers['x-client-id'] as string || 'unknown';

    const group = await groupService.createGroup(
      req.body,
      userId,
      clientId,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: req.headers['x-correlation-id'] as string,
      }
    );

    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const expectedVersion = parseInt(req.headers['if-match'] as string || '0', 10);
    
    const userId = req.headers['x-user-id'] as string || 'anonymous';
    const clientId = req.headers['x-client-id'] as string || 'unknown';

    const group = await groupService.updateGroup(
      req.params.id,
      req.body,
      userId,
      clientId,
      expectedVersion,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: req.headers['x-correlation-id'] as string,
      }
    );

    res.json(group);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const groups = groupService.getGroupsForUser(req.params.userId);
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const group = groupService.getGroupById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
