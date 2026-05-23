const express = require('express');
const router = express.Router();

router.get('/samples', (req, res) => {
  res.json({ success: true, message: 'Export samples endpoint' });
});

router.get('/logs', (req, res) => {
  res.json({ success: true, message: 'Export logs endpoint' });
});

module.exports = router;
