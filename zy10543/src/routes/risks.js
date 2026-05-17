const express = require('express');
const router = express.Router();
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const RiskService = require('../services/riskService');
const {
  validateCreateRisk,
  validateTransitionStatus,
  validateManualCorrection
} = require('../middleware/validation');

router.post('/', validateCreateRisk, async (req, res) => {
  try {
    const risk = await RiskService.createRisk(req.body, req.body.created_by);
    res.json({
      success: true,
      data: risk
    });
  } catch (error) {
    await RiskService.recordFailedOperation(
      'create_risk',
      null,
      req.body,
      error.message,
      { endpoint: req.path, method: req.method }
    );
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      project_code: req.query.project_code,
      status: req.query.status,
      owner: req.query.owner
    };
    const risks = await RiskService.getRisks(filters);
    res.json({
      success: true,
      data: risks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/statuses', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        statuses: RiskService.getStatuses(),
        transitions: RiskService.getStatusTransitions()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const risk = await RiskService.getRiskById(req.params.id);
    if (!risk) {
      return res.status(404).json({
        success: false,
        error: '风险记录不存在'
      });
    }
    res.json({
      success: true,
      data: risk
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const risk = await RiskService.getRiskById(req.params.id);
    if (!risk) {
      return res.status(404).json({
        success: false,
        error: '风险记录不存在'
      });
    }
    const history = await RiskService.getRiskHistory(req.params.id);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/transition', validateTransitionStatus, async (req, res) => {
  try {
    const risk = await RiskService.transitionStatus(
      req.params.id,
      req.body.to_status,
      req.body.action_by,
      req.body.comment,
      req.body.evidence
    );
    res.json({
      success: true,
      data: risk
    });
  } catch (error) {
    await RiskService.recordFailedOperation(
      'status_transition',
      req.params.id,
      req.body,
      error.message,
      { endpoint: req.path, method: req.method }
    );
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.patch('/:id/correct', validateManualCorrection, async (req, res) => {
  try {
    const risk = await RiskService.manualCorrection(
      req.params.id,
      req.body,
      req.body.corrected_by
    );
    res.json({
      success: true,
      data: risk
    });
  } catch (error) {
    await RiskService.recordFailedOperation(
      'manual_correction',
      req.params.id,
      req.body,
      error.message,
      { endpoint: req.path, method: req.method }
    );
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const filters = {
      project_code: req.query.project_code,
      status: req.query.status,
      owner: req.query.owner
    };
    const risks = await RiskService.exportRisks(filters);

    const csvWriter = createCsvWriter({
      path: '/tmp/risks-export.csv',
      header: [
        { id: 'id', title: '风险ID' },
        { id: 'project_code', title: '项目编号' },
        { id: 'risk_description', title: '风险描述' },
        { id: 'owner', title: '责任人' },
        { id: 'action_plan', title: '处理动作' },
        { id: 'close_condition', title: '关闭条件' },
        { id: 'status', title: '状态' },
        { id: 'report', title: '风险报告' },
        { id: 'created_by', title: '创建人' },
        { id: 'created_at', title: '创建时间' },
        { id: 'updated_at', title: '更新时间' },
        { id: 'closed_at', title: '关闭时间' },
        { id: 'closed_by', title: '关闭人' },
        { id: 'close_evidence', title: '关闭依据' },
        { id: 'version', title: '版本号' }
      ]
    });

    await csvWriter.writeRecords(risks);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=risks-export.csv');
    res.sendFile('/tmp/risks-export.csv');
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/export/json', async (req, res) => {
  try {
    const filters = {
      project_code: req.query.project_code,
      status: req.query.status,
      owner: req.query.owner
    };
    const risks = await RiskService.exportRisks(filters);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=risks-export.json');
    res.json(risks);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
