const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');

function handleAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.post('/issues', handleAsync(async (req, res) => {
  const result = await auditService.createIssue(req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.status(201).json(result);
}));

router.get('/issues', handleAsync(async (req, res) => {
  const filters = {
    status: req.query.status,
    department: req.query.department,
    risk_level: req.query.risk_level
  };
  Object.keys(filters).forEach(key => {
    if (filters[key] === undefined) delete filters[key];
  });
  
  const result = await auditService.listIssues(filters);
  res.json(result);
}));

router.get('/issues/:id', handleAsync(async (req, res) => {
  const result = await auditService.getIssueDetail(req.params.id);
  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
}));

router.post('/issues/:id/submit-plan', handleAsync(async (req, res) => {
  const result = await auditService.submitPlan(req.params.id, req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
}));

router.post('/issues/:id/approve-plan', handleAsync(async (req, res) => {
  const result = await auditService.approvePlan(req.params.id, req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
}));

router.post('/issues/:id/submit-evidence', handleAsync(async (req, res) => {
  const result = await auditService.submitEvidence(req.params.id, req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
}));

router.post('/issues/:id/customer-review', handleAsync(async (req, res) => {
  const result = await auditService.customerReview(req.params.id, req.body);
  if (!result.success) {
    if (result.code === 'EVIDENCE_MISSING') {
      return res.status(409).json(result);
    }
    return res.status(400).json(result);
  }
  res.json(result);
}));

router.post('/issues/:id/request-extension', handleAsync(async (req, res) => {
  const result = await auditService.requestExtension(req.params.id, req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
}));

router.post('/issues/:id/manual-correction', handleAsync(async (req, res) => {
  const result = await auditService.manualCorrection(req.params.id, req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
}));

router.post('/check-overdue', handleAsync(async (req, res) => {
  const result = await auditService.checkOverdue();
  res.json(result);
}));

router.get('/reports/summary', handleAsync(async (req, res) => {
  const filters = {
    status: req.query.status,
    department: req.query.department,
    risk_level: req.query.risk_level
  };
  Object.keys(filters).forEach(key => {
    if (filters[key] === undefined) delete filters[key];
  });
  
  const result = await auditService.generateReport(filters);
  res.json(result);
}));

router.get('/status-definitions', (req, res) => {
  res.json({
    success: true,
    data: {
      STATUS: auditService.STATUS,
      RISK_LEVELS: auditService.RISK_LEVELS,
      STATUS_DESCRIPTIONS: {
        'OPEN': '待处理',
        'PLAN_SUBMITTED': '整改计划已提交',
        'PLAN_APPROVED': '整改计划已审批',
        'EVIDENCE_SUBMITTED': '证据已提交待审核',
        'REJECTED': '客户退回需重新整改',
        'CLOSED': '已关闭(客户认可)',
        'OVERDUE': '已逾期',
        'ESCALATED': '已升级'
      }
    }
  });
});

module.exports = router;
