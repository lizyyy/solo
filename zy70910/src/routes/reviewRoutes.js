const express = require('express');
const router = express.Router();

router.get('/logs', (req, res) => {
  res.status(200).json({ message: '获取审核日志列表' });
});

router.post('/discrepancy/:id', (req, res) => {
  res.status(200).json({ message: '审核差异', id: req.params.id });
});

module.exports = router;
