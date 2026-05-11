const express = require('express');
const House = require('../models/House');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const house = await House.create(req.body);
    res.json(house);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const houses = await House.findAll();
    res.json(houses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const house = await House.findByPk(req.params.id);
    if (!house) return res.status(404).json({ error: '房源不存在' });
    res.json(house);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const house = await House.findByPk(req.params.id);
    if (!house) return res.status(404).json({ error: '房源不存在' });
    await house.update(req.body);
    res.json(house);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
