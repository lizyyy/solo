import { Router, type Request, type Response } from 'express';
import { retrieveBySignature } from '../services/exportService.js';

const router = Router();

router.post('/', (req: Request, res: Response): void => {
  const { signature } = req.body ?? {};

  if (!signature || typeof signature !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Missing or invalid signature',
    });
    return;
  }

  const result = retrieveBySignature(signature);

  if (!result) {
    res.status(404).json({
      success: false,
      error: 'Signature not found or invalid',
    });
    return;
  }

  res.json({
    success: true,
    data: result,
  });
});

export default router;
