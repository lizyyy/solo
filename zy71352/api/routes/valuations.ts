import { Router, Request, Response } from 'express';
import { upsertValuation } from '../services/artworkService.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { operator, ...data } = req.body;
    const valuation = await upsertValuation(data, operator);

    res.status(201).json({
      success: true,
      data: valuation,
      message: '估值信息保存成功',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Bad request',
    });
  }
});

export default router;
