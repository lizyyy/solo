import express from 'express';
import * as hitService from '../services/hitAndFreezeService';
import * as reviewService from '../services/reviewService';
import * as queryService from '../services/queryService';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { listVersionId, accountId, transactionId, matchReason, matchScore, createdBy } = req.body;
    if (!listVersionId || !accountId || !transactionId || !matchReason || matchScore === undefined || !createdBy) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const result = await hitService.createHitRecord(
      listVersionId, accountId, transactionId, matchReason, matchScore, createdBy
    );
    res.json({
      hitRecord: result.hitRecord,
      freeze: result.freeze,
      isRepeatHit: result.isRepeatHit,
      note: result.isRepeatHit 
        ? '检测到重复命中，账户已存在活跃冻结，本次仅记录命中不重复冻结' 
        : '首次命中，账户已冻结，等待人工复核'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const status = req.query.status as any;
    const result = await hitService.getAllHitRecords(status);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await queryService.getHitDetail(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const { decision, reviewer, comment } = req.body;
    if (!decision || !reviewer || !comment) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    if (decision !== 'approved' && decision !== 'rejected') {
      return res.status(400).json({ error: '决策值必须是 approved 或 rejected' });
    }
    const result = await reviewService.reviewHit(req.params.id, decision, reviewer, comment);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/close', async (req, res) => {
  try {
    const { actor } = req.body;
    if (!actor) {
      return res.status(400).json({ error: '缺少操作人信息' });
    }
    const result = await reviewService.closeHitRecord(req.params.id, actor);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
