const express = require('express');
const router = express.Router();
const FeeService = require('../services/fee.service');

router.get('/students/:studentId', (req, res) => {
  const fees = FeeService.getStudentFees(parseInt(req.params.studentId));
  res.json({ success: true, data: fees });
});

router.get('/adjustments', (req, res) => {
  const { student_id } = req.query;
  const adjustments = FeeService.getFeeAdjustments(
    student_id ? parseInt(student_id) : null
  );
  res.json({ success: true, data: adjustments });
});

router.post('/recalculate/:applicationId', (req, res) => {
  try {
    const { operator } = req.body;
    const result = FeeService.recalculateFee(
      parseInt(req.params.applicationId),
      operator || 'system'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/:feeId/pay', (req, res) => {
  try {
    const { operator } = req.body;
    const result = FeeService.markFeePaid(
      parseInt(req.params.feeId),
      operator || 'admin'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;