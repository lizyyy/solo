const express = require('express');
const router = express.Router();
const { ToleranceRule } = require('../models');

router.post('/', async (req, res) => {
  try {
    const rule = await ToleranceRule.create(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const rules = await ToleranceRule.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await ToleranceRule.destroy({ where: { id: req.params.id } });
    res.json({ success: true, message: '容差规则已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
