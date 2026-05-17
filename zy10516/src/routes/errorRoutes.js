const express = require('express');
const router = express.Router();
const store = require('../storage/memoryStore');
const { errorLogs } = require('../middleware/errorHandler');

router.get('/logs', (req, res) => {
  res.json({
    code: 'SUCCESS',
    data: errorLogs,
    total: errorLogs.length
  });
});

router.get('/contexts', (req, res) => {
  const contexts = store.getAllErrorContexts();
  res.json({
    code: 'SUCCESS',
    data: contexts,
    total: contexts.length
  });
});

router.get('/contexts/:errorId', (req, res, next) => {
  const context = store.getErrorContext(req.params.errorId);
  if (!context) {
    const error = new Error('错误上下文不存在');
    error.statusCode = 404;
    error.errorCode = 'CONTEXT_NOT_FOUND';
    error.processingBasis = '根据 errorId 在存储中未找到对应记录';
    return next(error);
  }
  res.json({
    code: 'SUCCESS',
    data: context
  });
});

module.exports = router;