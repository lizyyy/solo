const express = require('express');
const HostModel = require('../models/HostModel');

const router = express.Router();

router.get('/', async (req, res) => {
  const hosts = await HostModel.getAll();
  res.json({ success: true, data: hosts });
});

router.get('/:id', async (req, res) => {
  const host = await HostModel.getById(req.params.id);
  if (!host) {
    return res.status(404).json({ success: false, errors: ['主持人不存在'] });
  }
  res.json({ success: true, data: host });
});

router.post('/', async (req, res) => {
  const host = await HostModel.create(req.body);
  res.json({ success: true, data: host });
});

router.put('/:id', async (req, res) => {
  const host = await HostModel.update(req.params.id, req.body);
  res.json({ success: true, data: host });
});

router.delete('/:id', async (req, res) => {
  await HostModel.delete(req.params.id);
  res.json({ success: true });
});

router.get('/:id/leaves', async (req, res) => {
  const leaves = await HostModel.getLeaves(req.params.id);
  res.json({ success: true, data: leaves });
});

router.post('/leaves', async (req, res) => {
  const leave = await HostModel.addLeave(req.body);
  res.json({ success: true, data: leave });
});

module.exports = router;
