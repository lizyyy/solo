const express = require('express');
const router = express.Router();
const scheduleService = require('../services/scheduleService');
const equipmentService = require('../services/equipmentService');

router.get('/', async (req, res) => {
  try {
    const kitchens = await scheduleService.getKitchens();
    res.json(kitchens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, location, capacity } = req.body;
    if (!name) {
      return res.status(400).json({ error: '厨房名称不能为空' });
    }
    const id = await scheduleService.createKitchen({ name, location, capacity });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:kitchenId/equipments', async (req, res) => {
  try {
    const equipments = await equipmentService.getEquipmentsByKitchen(req.params.kitchenId);
    res.json(equipments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:kitchenId/equipments', async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name) {
      return res.status(400).json({ error: '设备名称不能为空' });
    }
    const id = await equipmentService.createEquipment({
      kitchen_id: parseInt(req.params.kitchenId),
      name,
      type
    });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
