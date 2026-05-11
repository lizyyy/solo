const express = require('express');
const Tenant = require('../models/Tenant');
const Room = require('../models/Room');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const room = await Room.findByPk(req.body.roomId);
    if (!room) return res.status(404).json({ error: '房间不存在' });
    const tenant = await Tenant.create({ ...req.body, status: 'active' });
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/checkout', async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ error: '租客不存在' });
    if (tenant.status === 'checked_out') {
      return res.status(400).json({ error: '租客已退租' });
    }
    await tenant.update({
      status: 'checked_out',
      checkOutDate: req.body.checkOutDate
    });
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/room/:roomId', async (req, res) => {
  try {
    const tenants = await Tenant.findAll({ 
      where: { roomId: req.params.roomId },
      order: [['checkInDate', 'DESC']]
    });
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/active/house/:houseId', async (req, res) => {
  try {
    const tenants = await Tenant.findAll({
      include: [{ model: Room, where: { houseId: req.params.houseId } }],
      where: { status: 'active' }
    });
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id, { include: [Room] });
    if (!tenant) return res.status(404).json({ error: '租客不存在' });
    res.json(tenant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
