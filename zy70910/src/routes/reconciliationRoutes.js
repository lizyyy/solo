const express = require('express');
const router = express.Router();

router.post('/start', (req, res) => {
  res.status(200).json({ message: '开始对账' });
});

router.get('/tasks', (req, res) => {
  res.status(200).json({ message: '获取对账任务列表' });
});

router.get('/tasks/:id', (req, res) => {
  res.status(200).json({ message: '获取对账任务详情', id: req.params.id });
});

module.exports = router;
