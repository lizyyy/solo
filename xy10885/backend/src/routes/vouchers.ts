import express from 'express';
import * as voucherService from '../services/voucher.service';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await voucherService.getVouchers(req.query);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const voucher = await voucherService.getVoucherById(req.params.id);
    if (!voucher) {
      return res.status(404).json({ success: false, error: '预约凭证不存在' });
    }
    res.json({ success: true, data: voucher });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/code/:code', async (req, res) => {
  try {
    const voucher = await voucherService.getVoucherByCode(req.params.code);
    if (!voucher) {
      return res.status(404).json({ success: false, error: '预约凭证不存在' });
    }
    res.json({ success: true, data: voucher });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/checkin', async (req, res) => {
  try {
    const voucher = await voucherService.checkInVoucher(req.params.id, req.body.operator);
    res.json({ success: true, data: voucher });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const voucher = await voucherService.cancelVoucher(req.params.id, req.body.operator);
    res.json({ success: true, data: voucher });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
