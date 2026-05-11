const express = require('express');
const Room = require('../models/Room');
const House = require('../models/House');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const house = await House.findByPk(req.body.houseId);
    if (!house) return res.status(404).json({ error: '房源不存在' });
    const room = await Room.create(req.body);
    res.json(room);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/house/:houseId', async (req, res) => {
  try {
    const rooms = await Room.findAll({ where: { houseId: req.params.houseId } });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id);
    if (!room) return res.status(404).json({ error: '房间不存在' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
