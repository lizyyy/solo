import express from 'express';
import tireService from '../services/tireService';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { status, vehicle_id } = req.query;
    const tires = tireService.getAllTires({
      status: status as any,
      vehicle_id: vehicle_id as string,
    });
    res.json(tires);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const tire = tireService.getTireById(req.params.id);
    if (!tire) {
      return res.status(404).json({ error: '轮胎不存在' });
    }
    res.json(tire);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/lifecycle', (req, res) => {
  try {
    const lifecycle = tireService.getTireLifecycle(req.params.id);
    res.json(lifecycle);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/events', (req, res) => {
  try {
    const events = tireService.getTireEvents(req.params.id);
    res.json(events);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const tire = tireService.createTire(req.body);
    res.status(201).json(tire);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/install', (req, res) => {
  try {
    const { vehicle_id, performed_by, notes } = req.body;
    const tire = tireService.installTire(req.params.id, vehicle_id, performed_by, notes);
    res.json(tire);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/remove', (req, res) => {
  try {
    const { reason, performed_by, notes } = req.body;
    const tire = tireService.removeTire(req.params.id, reason, performed_by, notes);
    res.json(tire);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/inspect', (req, res) => {
  try {
    const { result, inspection_notes, cost, performed_by, notes } = req.body;
    const tire = tireService.inspectTire(req.params.id, result, inspection_notes, cost, performed_by, notes);
    res.json(tire);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/retread', (req, res) => {
  try {
    const { cost, performed_by, notes } = req.body;
    const tire = tireService.sendToRetread(req.params.id, cost, performed_by, notes);
    res.json(tire);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/complete-retread', (req, res) => {
  try {
    const { performed_by, notes } = req.body;
    const tire = tireService.completeRetread(req.params.id, performed_by, notes);
    res.json(tire);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/scrap', (req, res) => {
  try {
    const { reason, performed_by, notes } = req.body;
    const tire = tireService.scrapTire(req.params.id, reason, performed_by, notes);
    res.json(tire);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
