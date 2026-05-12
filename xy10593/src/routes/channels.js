const express = require('express');
const router = express.Router();
const customerService = require('../services/customerService');

router.get('/', (req, res) => {
  try {
    const channels = customerService.listChannels();
    res.json({ success: true, data: channels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const channel = customerService.getChannel(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, error: '渠道不存在' });
    }
    res.json({ success: true, data: channel });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const channel = customerService.createChannel(req.body);
    res.status(201).json({ success: true, data: channel });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
