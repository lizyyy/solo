const express = require('express');
const ScriptModel = require('../models/ScriptModel');

const router = express.Router();

router.get('/', async (req, res) => {
  const scripts = await ScriptModel.getAll();
  res.json({ success: true, data: scripts });
});

router.get('/:id', async (req, res) => {
  const script = await ScriptModel.getById(req.params.id);
  if (!script) {
    return res.status(404).json({ success: false, errors: ['剧本不存在'] });
  }
  res.json({ success: true, data: script });
});

router.post('/', async (req, res) => {
  const script = await ScriptModel.create(req.body);
  res.json({ success: true, data: script });
});

router.put('/:id', async (req, res) => {
  const script = await ScriptModel.update(req.params.id, req.body);
  res.json({ success: true, data: script });
});

router.delete('/:id', async (req, res) => {
  await ScriptModel.delete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
