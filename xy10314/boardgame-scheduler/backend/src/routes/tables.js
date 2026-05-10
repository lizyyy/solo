const express = require('express');
const TableModel = require('../models/TableModel');

const router = express.Router();

router.get('/', async (req, res) => {
  const tables = await TableModel.getAll();
  res.json({ success: true, data: tables });
});

router.get('/:id', async (req, res) => {
  const table = await TableModel.getById(req.params.id);
  if (!table) {
    return res.status(404).json({ success: false, errors: ['桌位不存在'] });
  }
  res.json({ success: true, data: table });
});

router.post('/', async (req, res) => {
  const table = await TableModel.create(req.body);
  res.json({ success: true, data: table });
});

router.put('/:id', async (req, res) => {
  const table = await TableModel.update(req.params.id, req.body);
  res.json({ success: true, data: table });
});

router.delete('/:id', async (req, res) => {
  await TableModel.delete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
