import express from 'express';
import * as systemService from '../services/externalSystem.service';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await systemService.getExternalSystems(req.query);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const system = await systemService.getExternalSystemById(req.params.id);
    if (!system) {
      return res.status(404).json({ success: false, error: '外部系统不存在' });
    }
    res.json({ success: true, data: system });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const system = await systemService.createExternalSystem(req.body);
    res.status(201).json({ success: true, data: system });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const system = await systemService.updateExternalSystemStatus(req.params.id, req.body.status);
    res.json({ success: true, data: system });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
