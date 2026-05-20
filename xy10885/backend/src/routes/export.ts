import express from 'express';
import fs from 'fs';
import * as exportService from '../services/export.service';

const router = express.Router();

router.get('/slots', async (req, res) => {
  try {
    const filePath = await exportService.exportSlotsToCsv();
    res.download(filePath, 'slots-export.csv', (err) => {
      if (!err) fs.unlinkSync(filePath);
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/vouchers', async (req, res) => {
  try {
    const filePath = await exportService.exportVouchersToCsv(req.query as any);
    res.download(filePath, 'vouchers-export.csv', (err) => {
      if (!err) fs.unlinkSync(filePath);
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const filePath = await exportService.exportStatisticsToCsv();
    res.download(filePath, 'statistics-export.csv', (err) => {
      if (!err) fs.unlinkSync(filePath);
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
