const express = require('express');
const router = express.Router();
const { login } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await login(username, password);
    res.json(result);
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

router.post('/logout', (req, res) => {
  res.json({ message: '登出成功' });
});

module.exports = router;
