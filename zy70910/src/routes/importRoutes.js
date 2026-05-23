const express = require('express');
const router = express.Router();

router.post('/orders', (req, res) => {
  res.status(200).json({ message: '导入订单数据' });
});

router.post('/payments', (req, res) => {
  res.status(200).json({ message: '导入支付数据' });
});

router.post('/charger-logs', (req, res) => {
  res.status(200).json({ message: '导入充电日志' });
});

module.exports = router;
