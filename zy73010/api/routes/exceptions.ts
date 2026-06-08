import express, { type Request, type Response } from 'express';
import type { ReviewStatus } from '../../shared/types.js';
import { db } from '../data/db.js';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  db.recheckAllConsistency();
  res.json({ success: true, data: db.exceptionQueue });
});

router.patch('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, operator = '寄养店长老周' } = req.body;
  const exc = db.exceptionQueue.find(e => e.id === id);
  if (!exc) {
    return res.status(404).json({ success: false, error: '异常记录不存在' });
  }

  exc.status = status as ReviewStatus;
  exc.isConsistent = db.checkConsistency(exc);

  const record = db.boardingRecords.find(r => r.id === exc.recordId);
  if (record) {
    record.reviewStatus = status as ReviewStatus;
    const latestRemark = record.remarks[record.remarks.length - 1];
    if (latestRemark) {
      latestRemark.status = status as ReviewStatus;
      latestRemark.updatedAt = new Date().toISOString();
      latestRemark.operator = operator;
    }
  }

  res.json({
    success: true,
    data: {
      exception: exc,
      isConsistent: exc.isConsistent,
      consistencyCheck: {
        status: exc.status,
        remark: exc.remark,
        fileConclusion: exc.fileConclusion,
        passed: exc.isConsistent,
        message: exc.isConsistent
          ? '状态↔备注↔文件结论三者一致 ✓'
          : '⚠️ 不一致：当前状态关键词与备注/文件结论不匹配，请确认内容',
      },
    },
  });
});

export default router;
