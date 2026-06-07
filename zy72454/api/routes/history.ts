import { Router, Request, Response } from 'express';
import { getAllHistory, rollbackToHistory } from '../services/historyService.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const history = getAllHistory(200);
  res.json({ data: history });
});

router.post('/rollback/:id', (req: Request, res: Response) => {
  try {
    const { rollbackBy } = req.body;
    const success = rollbackToHistory(
      req.params.id,
      rollbackBy || '系统管理员'
    );

    if (!success) {
      return res.status(400).json({
        error: {
          code: 'ROLLBACK_NO_SNAPSHOT',
          message: '找不到可以回滚的历史快照',
          suggestion: '这条记录可能是刚创建的，还没有修改历史',
        },
      });
    }

    res.json({ data: { success: true, message: '已回滚到指定历史版本' } });
  } catch (err) {
    res.status(400).json({
      error: {
        code: 'ROLLBACK_FAILED',
        message: '回滚失败',
        suggestion: '请稍后重试，或联系系统管理员',
      },
    });
  }
});

export default router;
