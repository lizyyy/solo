import express from 'express';
import * as slotService from '../services/slot.service';
import * as lockService from '../services/lock.service';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await slotService.getSlots(req.query);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const slot = await slotService.getSlotById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, error: '号源不存在' });
    }
    res.json({ success: true, data: slot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/timeline', async (req, res) => {
  try {
    const timeline = await slotService.getSlotTimeline(req.params.id);
    res.json({ success: true, data: timeline });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const slot = await slotService.createSlot(req.body);
    res.status(201).json({ success: true, data: slot });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/pull', async (req, res) => {
  try {
    const { external_system_id, date } = req.body;
    const result = await slotService.pullSlotsFromSystem(external_system_id, date);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/lock', async (req, res) => {
  try {
    const lock = await lockService.createLock({
      ...req.body,
      slot_id: req.params.id
    });
    res.status(201).json({ success: true, data: lock });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
