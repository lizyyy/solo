const express = require('express');
const router = express.Router();
const tableService = require('../services/tableService');

router.get('/', async (req, res) => {
  try {
    const data = await tableService.getAllTables();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/available', async (req, res) => {
  try {
    const data = await tableService.getAvailableTables(req.query.type_id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await tableService.getTableById(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await tableService.createTable(req.body, req.body.operator || 'system');
    res.json({ success: true, id: result.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await tableService.updateTable(req.params.id, req.body, req.body.operator || 'system');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    await tableService.updateTableStatus(req.params.id, req.body.status, req.body.operator || 'system');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await tableService.deleteTable(req.params.id, req.query.operator || 'system');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
