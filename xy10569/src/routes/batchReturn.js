const express = require('express');
const router = express.Router();
const batchReturnService = require('../services/batchReturnService');

router.post('/create', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const { request_id, return_date } = req.body;

  if (!request_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'request_id 为必填项（用于幂等控制）',
      code: 'MISSING_REQUEST_ID'
    });
  }

  const result = await batchReturnService.create(request_id, operatorId, return_date);
  const status = result.success ? 201 : 400;
  res.status(status).json(result);
});

router.post('/:batchReturnId/add-item', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const { borrow_id } = req.body;

  if (!borrow_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'borrow_id 为必填项',
      code: 'MISSING_BORROW_ID'
    });
  }

  const result = await batchReturnService.addItem(req.params.batchReturnId, borrow_id, operatorId);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

router.post('/:batchReturnId/process', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const { return_date } = req.body;

  const result = await batchReturnService.process(req.params.batchReturnId, operatorId, return_date);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

router.post('/quick', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const { borrow_ids, return_date, request_id } = req.body;

  if (!borrow_ids || !Array.isArray(borrow_ids) || borrow_ids.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'borrow_ids 数组为必填项且不能为空',
      code: 'MISSING_BORROW_IDS'
    });
  }

  const result = await batchReturnService.quickReturn(borrow_ids, operatorId, return_date, request_id);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

router.get('/', async (req, res) => {
  const batchReturns = await batchReturnService.list(req.query);
  res.json({ success: true, data: batchReturns });
});

router.get('/:id', async (req, res) => {
  const batchReturn = await batchReturnService.getById(req.params.id);
  if (!batchReturn) {
    return res.status(404).json({ success: false, error: '批量归还记录不存在' });
  }
  res.json({ success: true, data: batchReturn });
});

router.get('/request/:requestId', async (req, res) => {
  const batchReturn = await batchReturnService.getByRequestId(req.params.requestId);
  if (!batchReturn) {
    return res.status(404).json({ success: false, error: '批量归还记录不存在' });
  }
  res.json({ success: true, data: batchReturn });
});

module.exports = router;
