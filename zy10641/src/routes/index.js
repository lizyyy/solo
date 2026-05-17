const express = require('express');
const batchRouter = require('./batch');

const router = express.Router();

router.use('/batch', batchRouter);

router.get('/health', (req, res) => {
  res.success({ status: 'ok' }, '服务正常');
});

module.exports = router;
