const express = require('express');
const router = express.Router();
const equipmentService = require('../services/equipmentService');

router.post('/equipment', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = await equipmentService.createEquipment(req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/equipment', async (req, res) => {
  try {
    const result = await equipmentService.listEquipment(req.query);
    res.json({ success: true, data: result, count: result.length });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/equipment/:equipmentId', async (req, res) => {
  try {
    const result = await equipmentService.getEquipment(req.params.equipmentId);
    if (!result) {
      return res.status(404).json({ success: false, error: '设备不存在' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/equipment/:equipmentId/status-history', async (req, res) => {
  try {
    const result = await equipmentService.getEquipmentStatusHistory(req.params.equipmentId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/equipment/:equipmentId', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = await equipmentService.updateEquipment(req.params.equipmentId, req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;