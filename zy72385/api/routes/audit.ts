import { Router, Request, Response } from 'express';
import { getChangeHistory, getChangeImpact, compareVersions } from '../services/auditService.js';
import type { ChangeRecord } from '../../shared/types.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.query;
    const history = await getChangeHistory(
      entityType as ChangeRecord['entityType'] | undefined,
      entityId as string | undefined
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit history' });
  }
});

router.get('/:id/impact', async (req: Request, res: Response) => {
  try {
    const impact = await getChangeImpact(req.params.id);
    if (!impact) {
      res.status(404).json({ error: 'Change record not found' });
      return;
    }
    res.json(impact);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch change impact' });
  }
});

router.get('/compare/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const changes = await compareVersions(
      entityType as ChangeRecord['entityType'],
      entityId
    );
    if (!changes) {
      res.status(404).json({ error: 'No changes found' });
      return;
    }
    res.json(changes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to compare versions' });
  }
});

export default router;
