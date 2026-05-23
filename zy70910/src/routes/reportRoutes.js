const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({ message: '获取报表列表' });
});

router.get('/:id', (req, res) => {
  res.status(200).json({ message: '获取报表详情', id: req.params.id });
});

router.post('/generate', (req, res) => {
  res.status(200).json({ message: '生成报表' });
});

router.get('/:id/download', (req, res) => {
  res.status(200).json({ message: '下载报表', id: req.params.id });
});

module.exports = router;
