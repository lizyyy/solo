const express = require('express');
const router = express.Router();
const borrowService = require('../services/borrowService');

router.post('/borrow', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const { student_id, book_id, loan_days, request_id } = req.body;

  if (!student_id || !book_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'student_id 和 book_id 为必填项',
      code: 'MISSING_REQUIRED'
    });
  }

  const result = await borrowService.borrow(student_id, book_id, {
    loanDays: loan_days,
    requestId: request_id
  }, operatorId);

  const status = result.success ? 201 : 400;
  res.status(status).json(result);
});

router.post('/batch-borrow', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const { class_id, teacher_id, books } = req.body;

  if (!class_id || !teacher_id || !books || !Array.isArray(books)) {
    return res.status(400).json({ 
      success: false, 
      error: 'class_id、teacher_id 和 books 数组为必填项',
      code: 'MISSING_REQUIRED'
    });
  }

  const pairs = books.map(b => ({
    studentId: b.student_id,
    bookId: b.book_id
  }));

  const result = await borrowService.batchBorrow(class_id, teacher_id, pairs, operatorId);
  const status = result.success ? 201 : 400;
  res.status(status).json(result);
});

router.post('/renew/:borrowId', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const { reason } = req.body;

  const result = await borrowService.renew(req.params.borrowId, operatorId, reason);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

router.post('/return/:borrowId', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const { return_date } = req.body;

  const result = await borrowService.returnBook(req.params.borrowId, return_date, operatorId);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

router.get('/', async (req, res) => {
  const borrows = await borrowService.list(req.query);
  res.json({ success: true, data: borrows });
});

router.get('/:id', async (req, res) => {
  const borrow = await borrowService.getById(req.params.id);
  if (!borrow) {
    return res.status(404).json({ success: false, error: '借阅记录不存在' });
  }
  res.json({ success: true, data: borrow });
});

router.get('/student/:studentId', async (req, res) => {
  const borrows = await borrowService.getStudentBorrows(req.params.studentId);
  res.json({ success: true, data: borrows });
});

router.get('/:id/renew-history', async (req, res) => {
  const history = await borrowService.getRenewHistory(req.params.id);
  res.json({ success: true, data: history });
});

router.get('/:id/overdue-status', async (req, res) => {
  const borrow = await borrowService.getById(req.params.id);
  if (!borrow) {
    return res.status(404).json({ success: false, error: '借阅记录不存在' });
  }
  const status = borrowService.calculateOverdueStatus(borrow);
  res.json({ success: true, data: { borrow, overdueStatus: status } });
});

router.post('/refresh-overdue', async (req, res) => {
  const operatorId = req.headers['x-operator-id'] || 'admin';
  const result = await borrowService.refreshOverdueStatus(operatorId);
  res.json(result);
});

module.exports = router;
