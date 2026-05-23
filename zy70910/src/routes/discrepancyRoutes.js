const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({ message: '获取差异列表' });
});

router.get('/:id', (req, res) => {
  res.status(200).json({ message: '获取差异详情', id: req.params.id });
});

router.put('/:id', (req, res) => {
  res.status(200).json({ message: '更新差异状态', id: req.params.id });
});

module.exports = router;
