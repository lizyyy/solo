const express = require('express');
const router = express.Router();
const {
  distributeBatch,
  getDistributionById,
  getDistributionsByBatch,
  getDistributionsByRecipient,
  verifyDistribution,
  failDistributionVerification,
  recallBatch,
  getRecallById,
  getRecallsByBatch,
  updateRecallStatus,
  getDonationDistributionSummary,
  VERIFICATION_STATUSES,
  RECALL_STATUSES
} = require('../services/distributionService');

router.get('/statuses', (req, res) => {
  res.json({
    success: true,
    data: {
      verification_statuses: VERIFICATION_STATUSES,
      recall_statuses: RECALL_STATUSES
    }
  });
});

router.post('/distribute', (req, res) => {
  try {
    const { batchId, recipientId, containersUsed, verifiedBy, notes } = req.body;

    if (!batchId || !recipientId || !containersUsed) {
      return res.status(400).json({
        error: '缺少必要字段',
        required: ['batchId', 'recipientId', 'containersUsed'],
        code: 'MISSING_FIELDS'
      });
    }

    const distribution = distributeBatch(batchId, recipientId, containersUsed, verifiedBy, notes);
    res.status(201).json({
      success: true,
      data: distribution,
      message: '发放登记成功'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'DISTRIBUTE_FAILED'
    });
  }
});

router.get('/distributions/:id', (req, res) => {
  try {
    const distribution = getDistributionById(req.params.id);
    if (!distribution) {
      return res.status(404).json({
        error: '发放记录不存在',
        code: 'NOT_FOUND'
      });
    }
    res.json({
      success: true,
      data: distribution
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.get('/distributions/batch/:batchId', (req, res) => {
  try {
    const distributions = getDistributionsByBatch(req.params.batchId);
    res.json({
      success: true,
      data: distributions,
      count: distributions.length
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.get('/distributions/recipient/:recipientId', (req, res) => {
  try {
    const distributions = getDistributionsByRecipient(req.params.recipientId);
    res.json({
      success: true,
      data: distributions,
      count: distributions.length
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.post('/distributions/:id/verify', (req, res) => {
  try {
    const { verifiedBy, notes } = req.body;

    if (!verifiedBy) {
      return res.status(400).json({
        error: '核验人不能为空',
        code: 'MISSING_VERIFIER'
      });
    }

    const result = verifyDistribution(req.params.id, verifiedBy, notes);

    if (result === null) {
      return res.status(404).json({
        error: '发放记录不存在',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: result,
      message: result._message || '核验成功'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'VERIFY_FAILED'
    });
  }
});

router.post('/distributions/:id/fail', (req, res) => {
  try {
    const { reason, notes } = req.body;

    if (!reason) {
      return res.status(400).json({
        error: '核验失败必须提供原因',
        code: 'MISSING_REASON'
      });
    }

    const result = failDistributionVerification(req.params.id, reason, notes);

    if (result === null) {
      return res.status(404).json({
        error: '发放记录不存在',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: result,
      message: '核验失败已记录'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'FAIL_FAILED'
    });
  }
});

router.post('/recalls', (req, res) => {
  try {
    const { batchId, reason, recalledQuantity, recalledContainers, notes } = req.body;

    if (!batchId || !reason) {
      return res.status(400).json({
        error: '缺少必要字段',
        required: ['batchId', 'reason'],
        code: 'MISSING_FIELDS'
      });
    }

    const recall = recallBatch(batchId, reason, recalledQuantity, recalledContainers, notes);
    res.status(201).json({
      success: true,
      data: recall,
      message: '召回发起成功'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'RECALL_FAILED'
    });
  }
});

router.get('/recalls/:id', (req, res) => {
  try {
    const recall = getRecallById(req.params.id);
    if (!recall) {
      return res.status(404).json({
        error: '召回记录不存在',
        code: 'NOT_FOUND'
      });
    }
    res.json({
      success: true,
      data: recall
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.get('/recalls/batch/:batchId', (req, res) => {
  try {
    const recalls = getRecallsByBatch(req.params.batchId);
    res.json({
      success: true,
      data: recalls,
      count: recalls.length
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.patch('/recalls/:id/status', (req, res) => {
  try {
    const { status, recalledQuantity, recalledContainers, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        error: '缺少 status 字段',
        code: 'MISSING_FIELDS'
      });
    }

    const result = updateRecallStatus(req.params.id, status, recalledQuantity, recalledContainers, notes);

    if (result === null) {
      return res.status(404).json({
        error: '召回记录不存在',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: result,
      message: '召回状态更新成功'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'UPDATE_FAILED'
    });
  }
});

router.get('/donation-summary/:donationId', (req, res) => {
  try {
    const summary = getDonationDistributionSummary(req.params.donationId);
    if (!summary) {
      return res.status(404).json({
        error: '捐赠记录不存在',
        code: 'NOT_FOUND'
      });
    }
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

module.exports = router;
