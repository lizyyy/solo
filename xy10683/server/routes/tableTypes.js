const express = require('express');
const router = express.Router();
const tableTypeService = require('../services/tableTypeService');

router.get('/', async (req, res) => {
  try {
    const data = await tableTypeService.getAllTableTypes();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await tableTypeService.getTableTypeById(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await tableTypeService.createTableType(req.body, req.body.operator || 'system');
    res.json({ success: true, id: result.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await tableTypeService.updateTableType(req.params.id, req.body, req.body.operator || 'system');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await tableTypeService.deleteTableType(req.params.id, req.query.operator || 'system');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
