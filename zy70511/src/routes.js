const express = require('express');
const router = express.Router();
const quotaService = require('./services/quotaService');
const { Parser } = require('json2csv');

function handleError(res, error) {
  console.error('API Error:', error);
  if (error.code && error.message) {
    res.status(400).json({
      error: {
        code: error.code,
        message: error.message
      }
    });
  } else {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
        details: error.message
      }
    });
  }
}

router.post('/teams', async (req, res) => {
  try {
    const { name, cpuQuota, storageQuota } = req.body;
    const result = await quotaService.createTeam(name, cpuQuota, storageQuota);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/teams', async (req, res) => {
  try {
    const teams = await quotaService.listTeams();
    res.json(teams);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/borrows', async (req, res) => {
  try {
    const result = await quotaService.createBorrowRequest(req.body);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/borrows', async (req, res) => {
  try {
    const filters = {
      borrowerTeam: req.query.borrowerTeam,
      lenderTeam: req.query.lenderTeam,
      status: req.query.status,
      resourceType: req.query.resourceType
    };
    const records = await quotaService.listBorrowRecords(filters);
    res.json(records);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/borrows/:requestId', async (req, res) => {
  try {
    const record = await quotaService.getBorrowRecord(req.params.requestId);
    res.json(record);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/borrows/:requestId/approve', async (req, res) => {
  try {
    const { approver, comment } = req.body;
    const result = await quotaService.approveRequest(req.params.requestId, approver, comment);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/borrows/:requestId/reject', async (req, res) => {
  try {
    const { approver, comment } = req.body;
    const result = await quotaService.rejectRequest(req.params.requestId, approver, comment);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/borrows/:requestId/return', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await quotaService.returnResource(req.params.requestId, operator);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/borrows/:requestId/settle', async (req, res) => {
  try {
    const { settlementSummary, operator } = req.body;
    const result = await quotaService.settleRecord(req.params.requestId, settlementSummary, operator);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/borrows/:requestId/correct', async (req, res) => {
  try {
    const { data, operator } = req.body;
    const result = await quotaService.manualCorrect(req.params.requestId, data, operator);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/borrows/:requestId/logs', async (req, res) => {
  try {
    const record = await quotaService.getBorrowRecord(req.params.requestId);
    const logs = await quotaService.getOperationLogs(record.id);
    res.json(logs);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/overdue/check', async (req, res) => {
  try {
    const result = await quotaService.checkOverdue();
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/reports/settlement', async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          code: 'MISSING_PARAMS',
          message: '请提供 startDate 和 endDate 参数'
        }
      });
    }

    const data = await quotaService.exportSettlementReport(startDate, endDate);

    if (format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(data);
      res.header('Content-Type', 'text/csv');
      res.attachment(`settlement-report-${startDate}-${endDate}.csv`);
      res.send(csv);
    } else {
      res.json(data);
    }
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/statuses', (req, res) => {
  res.json({
    statuses: quotaService.STATUS,
    resourceTypes: quotaService.RESOURCE_TYPES
  });
});

module.exports = router;
