import { Router, Request, Response } from 'express';
import { upsertInsuranceClause } from '../services/artworkService.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { operator, ...data } = req.body;
    const clause = await upsertInsuranceClause(data, operator);

    res.status(201).json({
      success: true,
      data: clause,
      message: '保险条款保存成功',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Bad request',
    });
  }
});

export default router;
