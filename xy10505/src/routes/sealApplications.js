const express = require('express');
const router = express.Router();
const sealService = require('../services/sealApplicationService');
const contractService = require('../services/contractService');
const reportService = require('../services/reportService');
const riskEngine = require('../services/riskEngine');
const { buildSuccessResponse, buildErrorResponse } = require('../utils');

router.post('/', (req, res) => {
  try {
    const result = sealService.createApplication(req.body);
    res.json(buildSuccessResponse(result, '用章申请创建成功'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.post('/:id/submit', (req, res) => {
  try {
    const { operator } = req.body;
    if (!operator) {
      return res.status(400).json(buildErrorResponse('必须提供操作人', 400));
    }
    const result = sealService.submitApplication(req.params.id, operator);
    res.json(buildSuccessResponse(result, '提交审批成功'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.post('/:id/approve', (req, res) => {
  try {
    const { approver, comment } = req.body;
    if (!approver) {
      return res.status(400).json(buildErrorResponse('必须提供审批人', 400));
    }
    const result = sealService.approveStep(req.params.id, approver, comment || '');
    res.json(buildSuccessResponse(result, '审批通过'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.post('/:id/reject', (req, res) => {
  try {
    const { approver, reason } = req.body;
    if (!approver || !reason) {
      return res.status(400).json(buildErrorResponse('必须提供审批人和驳回理由', 400));
    }
    const result = sealService.rejectStep(req.params.id, approver, reason);
    res.json(buildSuccessResponse(result, '审批驳回'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.post('/:id/withdraw', (req, res) => {
  try {
    const { operator, reason } = req.body;
    if (!operator || !reason) {
      return res.status(400).json(buildErrorResponse('必须提供操作人和撤回理由', 400));
    }
    const result = sealService.withdrawApplication(req.params.id, operator, reason);
    res.json(buildSuccessResponse(result, '撤回成功'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.post('/:id/resubmit', (req, res) => {
  try {
    const result = sealService.resubmitApplication(req.params.id, req.body);
    res.json(buildSuccessResponse(result, '重提成功'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.post('/:id/seal', (req, res) => {
  try {
    const { operator, sealCount, remark } = req.body;
    if (!operator) {
      return res.status(400).json(buildErrorResponse('必须提供操作人', 400));
    }
    const result = sealService.confirmSeal(
      req.params.id, 
      operator, 
      sealCount || 1, 
      remark || ''
    );
    res.json(buildSuccessResponse(result, '用章确认成功'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.post('/:id/scan', (req, res) => {
  try {
    const application = sealService.getApplicationById(req.params.id);
    if (!application) {
      return res.status(404).json(buildErrorResponse('申请不存在', 404));
    }
    const contract = contractService.getContractById(application.contract_id);
    const history = sealService.getApplicationsByContract(application.contract_id);
    const result = riskEngine.runRiskScan(application, contract, history);
    res.json(buildSuccessResponse(result, '风险扫描完成'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.get('/:id', (req, res) => {
  try {
    const detail = sealService.getApplicationDetail(req.params.id);
    if (!detail) {
      return res.status(404).json(buildErrorResponse('申请不存在', 404));
    }
    res.json(buildSuccessResponse(detail, '查询成功'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.get('/', (req, res) => {
  try {
    const { status, applicant, contractId, limit = 100, offset = 0 } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (applicant) filters.applicant = applicant;
    if (contractId) filters.contractId = contractId;
    
    const applications = sealService.getApplications(
      filters, 
      parseInt(limit), 
      parseInt(offset)
    );
    res.json(buildSuccessResponse(applications, '查询成功'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.get('/:id/timeline', (req, res) => {
  try {
    const statusHistory = sealService.getStatusHistory(req.params.id);
    const approvalChain = sealService.getApprovalChain(req.params.id);
    const fieldChanges = sealService.getFieldChangeHistory(req.params.id);
    
    res.json(buildSuccessResponse({
      statusHistory,
      approvalChain,
      fieldChanges,
    }, '查询成功'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.get('/:id/risks', (req, res) => {
  try {
    const history = riskEngine.getApplicationRiskHistory(req.params.id);
    const latest = riskEngine.getLatestRiskScan(req.params.id);
    res.json(buildSuccessResponse({ history, latest }, '查询成功'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.get('/:id/report', (req, res) => {
  try {
    const report = reportService.generateApplicationReport(req.params.id);
    res.json(buildSuccessResponse(report, '报告生成成功'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.get('/:id/report/text', (req, res) => {
  try {
    const report = reportService.generateApplicationReport(req.params.id);
    const textReport = reportService.generateTextReport(report);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.id}.txt"`);
    res.send(textReport);
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

module.exports = router;
