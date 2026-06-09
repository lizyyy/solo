import { Router, type Request, type Response, type NextFunction } from 'express';
import * as layerService from '../services/layer.service.js';

const router = Router();

router.get('/layers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const layer = await layerService.getLayer(req.params.id);
    if (!layer) {
      res.status(404).json({ success: false, error: 'Layer not found' });
      return;
    }
    res.json({ success: true, data: layer });
  } catch (err) {
    next(err);
  }
});

router.post('/layers/:id/reviews', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const layer = await layerService.submitReview(req.params.id, req.body);
    if (!layer) {
      res.status(404).json({ success: false, error: 'Layer not found' });
      return;
    }
    res.status(201).json({ success: true, data: layer });
  } catch (err) {
    next(err);
  }
});

router.put('/layers/:id/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const layer = await layerService.appendNote(req.params.id, req.body);
    if (!layer) {
      res.status(404).json({ success: false, error: 'Layer not found' });
      return;
    }
    res.json({ success: true, data: layer });
  } catch (err) {
    next(err);
  }
});

export default router;
