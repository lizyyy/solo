import { Router, type Request, type Response } from 'express';
import { createOverride, getImpact } from '../services/overrideService.js';

const router = Router();

router.post('/', (req: Request, res: Response): void => {
  const payload = req.body ?? {};

  const requiredFields = ['itemId', 'batchId', 'reason', 'impactExplanation', 'before', 'after', 'createdBy'];
  const missing = requiredFields.filter((f) => !(f in payload));
  if (missing.length > 0) {
    res.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
    });
    return;
  }

  const result = createOverride(payload);

  if (!result) {
    res.status(404).json({
      success: false,
      error: 'Item or batch not found',
    });
    return;
  }

  res.status(201).json({
    success: true,
    data: result,
  });
});

router.get('/:id/impact', (req: Request, res: Response): void => {
  const { id } = req.params;
  const impact = getImpact(id);

  if (!impact) {
    res.status(404).json({
      success: false,
      error: 'Override not found',
    });
    return;
  }

  res.json({
    success: true,
    data: impact,
  });
});

export default router;
