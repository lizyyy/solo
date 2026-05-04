const express = require('express');
const riskService = require('../services/riskService');

const router = express.Router();

router.post('/recalculate', async (req, res) => {
  try {
    const { date } = req.body;
    const result = await riskService.runAllChecks(date);
    
    res.json({
      success: true,
      message: `风险重算完成，共检测到 ${result.total} 项风险`,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { warehouseId, type, status, severity } = req.query;
    let risks = riskService.getAllRisks();

    if (warehouseId) {
      risks = risks.filter(r => r.warehouseId === warehouseId);
    }
    if (type) {
      risks = risks.filter(r => r.type === type);
    }
    if (status) {
      risks = risks.filter(r => r.status === status);
    }
    if (severity) {
      risks = risks.filter(r => r.severity === severity);
    }

    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    risks.sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return new Date(b.detectedAt) - new Date(a.detectedAt);
    });

    res.json({
      success: true,
      count: risks.length,
      risks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:riskId', async (req, res) => {
  try {
    const { riskId } = req.params;
    const risk = riskService.getRiskById(riskId);
    
    if (!risk) {
      return res.status(404).json({
        success: false,
        error: '风险记录不存在'
      });
    }

    res.json({
      success: true,
      risk
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const risks = riskService.getAllRisks();
    
    const summary = {
      total: risks.length,
      pending: 0,
      reviewed: 0,
      byType: {},
      bySeverity: {},
      byStatus: {}
    };

    risks.forEach(risk => {
      if (risk.status === 'pending') {
        summary.pending++;
      } else if (risk.status === 'reviewed') {
        summary.reviewed++;
      }

      summary.byType[risk.type] = (summary.byType[risk.type] || 0) + 1;
      summary.bySeverity[risk.severity] = (summary.bySeverity[risk.severity] || 0) + 1;
      summary.byStatus[risk.status] = (summary.byStatus[risk.status] || 0) + 1;
    });

    res.json({
      success: true,
      ...summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
