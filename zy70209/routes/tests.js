const express = require('express');
const router = express.Router();
const {
  createTestResult,
  getTestResultById,
  getTestResultsByDonation,
  updateTestResult,
  cancelTestResult,
  TEST_TYPES,
  TEST_RESULTS,
  TEST_STATUSES
} = require('../services/testService');

router.get('/types', (req, res) => {
  res.json({
    success: true,
    data: {
      types: TEST_TYPES,
      results: TEST_RESULTS,
      statuses: TEST_STATUSES
    }
  });
});

router.post('/', (req, res) => {
  try {
    const { donationId, testType, result, testDate, testedBy, notes } = req.body;

    if (!donationId || !testType || !result || !testDate) {
      return res.status(400).json({
        error: '缺少必要字段',
        required: ['donationId', 'testType', 'result', 'testDate'],
        code: 'MISSING_FIELDS'
      });
    }

    const test = createTestResult(donationId, testType, result, testDate, testedBy, notes);
    
    const status = test._message ? 200 : 201;
    res.status(status).json({
      success: true,
      data: test,
      message: test._message || '检测结果录入成功'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'CREATE_FAILED'
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const test = getTestResultById(req.params.id);
    if (!test) {
      return res.status(404).json({
        error: '检测结果不存在',
        code: 'NOT_FOUND'
      });
    }
    res.json({
      success: true,
      data: test
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.get('/donation/:donationId', (req, res) => {
  try {
    const tests = getTestResultsByDonation(req.params.donationId);
    res.json({
      success: true,
      data: tests,
      count: tests.length
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const { result, testDate, testedBy, notes, status } = req.body;
    const updates = {};
    
    if (result !== undefined) updates.result = result;
    if (testDate !== undefined) updates.testDate = testDate;
    if (testedBy !== undefined) updates.testedBy = testedBy;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) updates.status = status;

    const test = updateTestResult(req.params.id, updates);

    if (test === null) {
      return res.status(404).json({
        error: '检测结果不存在',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: test,
      message: '检测结果更新成功'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'UPDATE_FAILED'
    });
  }
});

router.post('/:id/cancel', (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        error: '取消检测必须提供原因',
        code: 'MISSING_REASON'
      });
    }

    const result = cancelTestResult(req.params.id, reason);

    if (result === null) {
      return res.status(404).json({
        error: '检测结果不存在',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: result,
      message: '检测已取消'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'CANCEL_FAILED'
    });
  }
});

module.exports = router;
