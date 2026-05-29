import { Router, Request, Response } from 'express';
import { upsertTransportNode, updateTransportStatus } from '../services/artworkService.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { operator, ...data } = req.body;
    const node = await upsertTransportNode(data, operator);

    res.status(201).json({
      success: true,
      data: node,
      message: '运输节点保存成功',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Bad request',
    });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, status, timestamp } = req.body;
    const node = await updateTransportStatus(id, status, timestamp, operator);

    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Transport node not found',
      });
    }

    res.json({
      success: true,
      data: node,
      message: '运输状态更新成功',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Bad request',
    });
  }
});

export default router;
