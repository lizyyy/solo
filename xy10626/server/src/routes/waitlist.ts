import express from 'express';
import WaitlistService from '../services/WaitlistService';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await WaitlistService.getWaitlistList(req.query as any);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/inventory', async (req, res) => {
  try {
    const result = await WaitlistService.getTicketInventories();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/anomalies', async (req, res) => {
  try {
    const result = await WaitlistService.getAnomalies();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/:id/seats', async (req, res) => {
  try {
    const result = await WaitlistService.getCompanionSeats(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/:id/lock', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await WaitlistService.lockWaitlist(req.params.id, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/:id/unlock', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await WaitlistService.unlockWaitlist(req.params.id, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const { operator, seatNumbers } = req.body;
    const result = await WaitlistService.confirmWaitlist(req.params.id, operator, seatNumbers);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/:id/pay', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await WaitlistService.payWaitlist(req.params.id, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const { operator, needReview } = req.body;
    const result = await WaitlistService.cancelWaitlist(req.params.id, operator, needReview);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/:id/modify-seats', async (req, res) => {
  try {
    const { operator, seatNumbers } = req.body;
    const result = await WaitlistService.modifySeats(req.params.id, operator, seatNumbers);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/records/list', async (req, res) => {
  try {
    const result = await WaitlistService.getFlowRecords(req.query as any);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/records/:id/review', async (req, res) => {
  try {
    const { operator, approved } = req.body;
    const result = await WaitlistService.reviewCancel(req.params.id, operator, approved);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/export/report', async (req, res) => {
  try {
    const result = await WaitlistService.exportReport(req.query as any);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

export default router;
