const express = require('express');
const router = express.Router();
const renewalService = require('../services/renewalWorkflow');
const reportService = require('../services/reports');
const store = require('../models/store');

router.post('/create', async (req, res) => {
  try {
    const { customerId, requestId, operator } = req.body;
    
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const result = await renewalService.createWorkflow(
      customerId, 
      requestId, 
      operator || 'system'
    );

    res.json({
      success: true,
      data: result,
      message: result.isIdempotent ? '流程已存在（幂等返回）' : '续约流程创建成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:workflowId/aggregate', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { operator } = req.body;

    const result = await renewalService.aggregateData(workflowId, operator || 'system');

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:workflowId/check-health', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { operator } = req.body;

    const result = await renewalService.checkHealth(workflowId, operator || 'system');

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:workflowId/check-tickets', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { operator } = req.body;

    const result = await renewalService.checkTickets(workflowId, operator || 'system');

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:workflowId/prepare-quote', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { quoteData, operator } = req.body;

    if (!quoteData) {
      return res.status(400).json({ success: false, error: 'quoteData is required' });
    }

    const result = await renewalService.prepareQuote(
      workflowId, 
      quoteData, 
      operator || 'system'
    );

    res.json({
      success: true,
      data: result,
      message: result.approvalRequired 
        ? `需要 ${result.approvalInfo.approver} 级别审批` 
        : '报价准备完成'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:workflowId/approve-discount', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { quoteId, approval, operator } = req.body;

    if (!quoteId || !approval) {
      return res.status(400).json({ success: false, error: 'quoteId and approval are required' });
    }

    const result = await renewalService.approveDiscount(
      workflowId,
      quoteId,
      approval,
      operator || 'system'
    );

    res.json({
      success: true,
      data: result,
      message: approval.approved ? '折扣审批通过' : '折扣审批被拒绝'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:workflowId/ready-for-csm', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { operator } = req.body;

    const result = await renewalService.markReadyForCSM(workflowId, operator || 'system');

    res.json({
      success: true,
      data: result,
      message: '流程就绪，等待客户成功经理跟进'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:workflowId/customer-accept', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { operator, customerFeedback } = req.body;

    const result = await renewalService.customerAccept(
      workflowId, 
      operator || 'system', 
      customerFeedback
    );

    res.json({
      success: true,
      data: result,
      message: '客户已接受报价'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:workflowId/complete', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { operator, notes } = req.body;

    const result = await renewalService.complete(
      workflowId, 
      operator || 'system', 
      notes
    );

    res.json({
      success: true,
      data: result,
      message: '续约流程完成'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:workflowId/manual-correction', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { correction, operator } = req.body;

    if (!correction) {
      return res.status(400).json({ success: false, error: 'correction is required' });
    }

    const result = await renewalService.manualCorrection(
      workflowId,
      correction,
      operator || 'system'
    );

    res.json({
      success: true,
      data: result,
      message: '人工修正已记录'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:workflowId/exception', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { exception, operator } = req.body;

    if (!exception) {
      return res.status(400).json({ success: false, error: 'exception is required' });
    }

    const result = await renewalService.handleException(
      workflowId,
      exception,
      operator || 'system'
    );

    res.json({
      success: true,
      data: result,
      message: '异常已记录'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:workflowId', (req, res) => {
  try {
    const { workflowId } = req.params;
    const result = renewalService.getWorkflowWithHistory(workflowId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.get('/', (req, res) => {
  try {
    const { status, customerId } = req.query;
    const workflows = renewalService.getAllWorkflows({ status, customerId });

    res.json({
      success: true,
      data: workflows,
      count: workflows.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:workflowId/report', (req, res) => {
  try {
    const { workflowId } = req.params;
    const { format, type } = req.query;

    let report;
    if (type === 'communication') {
      report = reportService.generateCustomerCommunicationReport(workflowId);
    } else {
      report = reportService.generateRenewalReport(workflowId);
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=renewal-report-${workflowId}.csv`);
      res.send(reportService.exportToCSV(report));
    } else {
      res.json({
        success: true,
        data: report
      });
    }
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

module.exports = router;
