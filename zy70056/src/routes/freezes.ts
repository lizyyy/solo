import express from 'express';
import * as hitService from '../services/hitAndFreezeService';
import * as reviewService from '../services/reviewService';
import * as queryService from '../services/queryService';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await hitService.getAllFreezes();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await queryService.getFreezeDetail(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/request-unfreeze', async (req, res) => {
  try {
    const { requestedBy, unfreezeReason } = req.body;
    if (!requestedBy || !unfreezeReason) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const result = await reviewService.requestUnfreeze(req.params.id, requestedBy, unfreezeReason);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/approve-unfreeze', async (req, res) => {
  try {
    const { approver, comment } = req.body;
    if (!approver || !comment) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const result = await reviewService.approveUnfreeze(req.params.id, approver, comment);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/reject-unfreeze', async (req, res) => {
  try {
    const { approver, comment } = req.body;
    if (!approver || !comment) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const result = await reviewService.rejectUnfreeze(req.params.id, approver, comment);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
