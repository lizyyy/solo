const express = require('express');
const { login } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    const result = await login(username, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }
  res.json({
    user: req.user
  });
});

module.exports = router;
