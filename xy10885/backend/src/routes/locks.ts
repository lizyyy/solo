import express from 'express';
import * as lockService from '../services/lock.service';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await lockService.getLocks(req.query);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const lock = await lockService.getLockById(req.params.id);
    if (!lock) {
      return res.status(404).json({ success: false, error: '锁号记录不存在' });
    }
    res.json({ success: true, data: lock });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/release', async (req, res) => {
  try {
    const result = await lockService.releaseLock(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const voucher = await lockService.confirmLockToVoucher(req.params.id, req.body.operator);
    res.json({ success: true, data: voucher });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/check-expired', async (req, res) => {
  try {
    const result = await lockService.checkAndReleaseExpiredLocks();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
