import { Router, Request, Response } from 'express';
import * as settlementDao from '../dao/settlementDao';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { handled } = req.query;
    if (handled === 'false') {
      const exceptions = await settlementDao.getUnhandledExceptions();
      return res.json(exceptions);
    }
    const exceptions = await settlementDao.getAllExceptionRecords();
    res.json(exceptions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const exception = await settlementDao.getExceptionRecordById(id);
    if (!exception) {
      return res.status(404).json({ error: '异常记录不存在' });
    }
    res.json(exception);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/handle', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { handled_by, conclusion } = req.body;
    if (!handled_by || !conclusion) {
      return res.status(400).json({ error: '处理人和处理结论不能为空' });
    }
    await settlementDao.handleException(id, handled_by, conclusion);
    res.json({ success: true, message: '异常处理完成' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
