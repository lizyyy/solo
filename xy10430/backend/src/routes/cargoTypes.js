const express = require('express');
const router = express.Router();
const { CargoType } = require('../models');

router.get('/', async (req, res) => {
  try {
    const types = await CargoType.findAll({
      order: [['createdAt', 'ASC']]
    });
    res.json({ success: true, data: types });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const type = await CargoType.create(req.body);
    res.json({ success: true, data: type });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const type = await CargoType.findByPk(req.params.id);
    if (!type) {
      return res.status(404).json({ success: false, message: '货物类型不存在' });
    }
    await type.update(req.body);
    res.json({ success: true, data: type });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
