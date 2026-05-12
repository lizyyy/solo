const express = require('express');
const router = express.Router();
const { fineService, lostBookService } = require('../services/financialServices');

router.get('/fines', async (req, res) => {
  const fines = await fineService.list(req.query);
  res.json({ success: true, data: fines });
});

router.get('/fines/:id', async (req, res) => {
  const fine = await fineService.getById(req.params.id);
  if (!fine) {
    return res.status(404).json({ success: false, error: '罚款记录不存在' });
  }
  res.json({ success: true, data: fine });
});

router.get('/fines/student/:studentId', async (req, res) => {
  const fines = await fineService.getStudentFines(req.params.studentId);
  res.json({ success: true, data: fines });
});

router.post('/fines/:id/pay', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const { amount } = req.body;

  if (amount === undefined || amount <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'amount 为必填项且必须大于0',
      code: 'INVALID_AMOUNT'
    });
  }

  const result = await fineService.payFine(req.params.id, amount, operatorId);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

router.post('/fines/:id/waive', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const { amount, reason } = req.body;

  if (amount === undefined || amount <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'amount 为必填项且必须大于0',
      code: 'INVALID_AMOUNT'
    });
  }

  if (!reason) {
    return res.status(400).json({ 
      success: false, 
      error: 'reason 为必填项',
      code: 'MISSING_REASON'
    });
  }

  const result = await fineService.waiveFine(req.params.id, amount, reason, operatorId);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

router.post('/fines/refresh', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const result = await fineService.refreshOverdueFines(operatorId);
  res.json(result);
});

router.get('/lost-books', async (req, res) => {
  const lostBooks = await lostBookService.list(req.query);
  res.json({ success: true, data: lostBooks });
});

router.get('/lost-books/:id', async (req, res) => {
  const lostBook = await lostBookService.getById(req.params.id);
  if (!lostBook) {
    return res.status(404).json({ success: false, error: '丢书记录不存在' });
  }
  res.json({ success: true, data: lostBook });
});

router.get('/lost-books/student/:studentId', async (req, res) => {
  const lostBooks = await lostBookService.getStudentLostBooks(req.params.studentId);
  res.json({ success: true, data: lostBooks });
});

router.post('/lost-books/report', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const { borrow_id, reported_date } = req.body;

  if (!borrow_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'borrow_id 为必填项',
      code: 'MISSING_BORROW_ID'
    });
  }

  const result = await lostBookService.reportLost(borrow_id, operatorId, reported_date);
  const status = result.success ? 201 : 400;
  res.status(status).json(result);
});

router.post('/lost-books/:id/found', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const { found_date } = req.body;

  const result = await lostBookService.reportFound(req.params.id, operatorId, found_date);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

router.post('/lost-books/:id/pay', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const { amount } = req.body;

  if (amount === undefined || amount <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'amount 为必填项且必须大于0',
      code: 'INVALID_AMOUNT'
    });
  }

  const result = await lostBookService.payCompensation(req.params.id, amount, operatorId);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

router.post('/lost-books/:id/waive', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const { amount, reason } = req.body;

  if (amount === undefined || amount <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'amount 为必填项且必须大于0',
      code: 'INVALID_AMOUNT'
    });
  }

  if (!reason) {
    return res.status(400).json({ 
      success: false, 
      error: 'reason 为必填项',
      code: 'MISSING_REASON'
    });
  }

  const result = await lostBookService.waiveCompensation(req.params.id, amount, reason, operatorId);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

module.exports = router;
