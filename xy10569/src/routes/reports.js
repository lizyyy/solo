const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');
const borrowService = require('../services/borrowService');

router.get('/student/:studentId/status', async (req, res) => {
  const result = await reportService.getStudentStatus(req.params.studentId);
  const status = result.success ? 200 : 404;
  res.status(status).json(result);
});

router.get('/class/:classId/unreturned', async (req, res) => {
  const result = await reportService.getClassUnreturned(req.params.classId);
  const status = result.success ? 200 : 404;
  res.status(status).json(result);
});

router.get('/financial', async (req, res) => {
  const result = await reportService.getFinancialStats();
  res.json(result);
});

router.get('/audit/:entityType/:entityId', async (req, res) => {
  const logs = await reportService.getAuditHistory(req.params.entityType, req.params.entityId);
  res.json({ success: true, data: logs });
});

router.get('/export', async (req, res) => {
  const format = req.query.format || 'json';
  
  if (format === 'text') {
    const text = await reportService.exportReport('text');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } else {
    const json = await reportService.exportReport('json');
    res.json(json);
  }
});

router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    service: '校园借书逾期 API',
    timestamp: new Date().toISOString()
  });
});

router.get('/dashboard', async (req, res) => {
  const db = require('../database');
  
  const totalStudents = await db.get('SELECT COUNT(*) as count FROM students');
  const totalBooks = await db.get('SELECT COUNT(*) as count FROM books');
  const borrowedBooks = await db.get("SELECT COUNT(*) as count FROM borrow_records WHERE status IN ('borrowed', 'renewed', 'overdue')");
  const overdueBooks = await db.get("SELECT COUNT(*) as count FROM borrow_records WHERE status = 'overdue'");
  const lostBooks = await db.get("SELECT COUNT(*) as count FROM lost_books WHERE status IN ('reported', 'partial')");
  const availableCount = await db.get("SELECT COUNT(*) as count FROM books WHERE status = 'available'");
  
  const financial = await reportService.getFinancialStats();
  
  res.json({
    success: true,
    data: {
      overview: {
        totalStudents: totalStudents.count,
        totalBooks: totalBooks.count,
        availableBooks: availableCount.count,
        borrowedBooks: borrowedBooks.count,
        overdueBooks: overdueBooks.count,
        lostBooks: lostBooks.count
      },
      financial: financial.success ? financial : null
    }
  });
});

module.exports = router;
