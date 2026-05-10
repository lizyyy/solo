const express = require('express');
const router = express.Router();
const reconciliation = require('../modules/reconciliation');
const { getHistory } = require('../utils/audit');

router.get('/', (req, res) => {
  try {
    const { supplier_id, period, status } = req.query;
    const summaries = reconciliation.listReconciliationSummaries(supplier_id, period, status);
    
    res.json({
      success: true,
      data: summaries
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/calculate', (req, res) => {
  try {
    const { supplier_id, period } = req.body;
    const operator = req.headers['x-operator'] || 'api';
    
    if (!supplier_id || !period) {
      return res.status(400).json({
        success: false,
        error: '必须指定供应商ID和期间'
      });
    }
    
    const summary = reconciliation.calculateReconciliation(supplier_id, period, operator);
    
    res.json({
      success: true,
      data: summary,
      message: `核算计算完成，返利金额：${summary.rebate_amount.toFixed(2)}元`
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const summary = reconciliation.getReconciliationSummary(req.params.id);
    
    if (!summary) {
      return res.status(404).json({
        success: false,
        error: '核算汇总不存在'
      });
    }
    
    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/submit-confirmation', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api';
    const summary = reconciliation.submitForConfirmation(req.params.id, operator);
    
    res.json({
      success: true,
      data: summary,
      message: '已提交供应商确认'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/history', (req, res) => {
  try {
    const history = getHistory('reconciliation_summary', req.params.id);
    
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const history = getHistory('reconciliation_summary', req.params.id);
    
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/confirmation-letters', (req, res) => {
  try {
    const { summary_id, content } = req.body;
    const operator = req.headers['x-operator'] || 'api';
    
    if (!summary_id) {
      return res.status(400).json({
        success: false,
        error: '必须指定核算汇总ID'
      });
    }
    
    const letter = reconciliation.createConfirmationLetter(summary_id, content, operator);
    
    res.json({
      success: true,
      data: letter,
      message: '确认函创建成功'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/confirmation-letters', (req, res) => {
  try {
    const { supplier_id, status } = req.query;
    const letters = reconciliation.listConfirmationLetters(supplier_id, status);
    
    res.json({
      success: true,
      data: letters
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/confirmation-letters/:id', (req, res) => {
  try {
    const letter = reconciliation.getConfirmationLetter(req.params.id);
    
    if (!letter) {
      return res.status(404).json({
        success: false,
        error: '确认函不存在'
      });
    }
    
    res.json({
      success: true,
      data: letter
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/confirmation-letters/:id/send', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api';
    const letter = reconciliation.sendConfirmationLetter(req.params.id, operator);
    
    res.json({
      success: true,
      data: letter,
      message: '确认函已发送'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:summaryId/confirm', (req, res) => {
  try {
    const { letter_id, confirmed_by, comments } = req.body;
    const operator = req.headers['x-operator'] || 'api';
    
    if (!letter_id || !confirmed_by) {
      return res.status(400).json({
        success: false,
        error: '必须指定确认函ID和确认人'
      });
    }
    
    const result = reconciliation.confirmReconciliation(
      req.params.summaryId,
      letter_id,
      confirmed_by,
      comments || '',
      operator
    );
    
    res.json({
      success: true,
      data: result,
      message: '核算已确认'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:summaryId/reject', (req, res) => {
  try {
    const { letter_id, comments } = req.body;
    const operator = req.headers['x-operator'] || 'api';
    
    if (!letter_id || !comments) {
      return res.status(400).json({
        success: false,
        error: '必须指定确认函ID和拒绝原因'
      });
    }
    
    const summary = reconciliation.rejectReconciliation(
      req.params.summaryId,
      letter_id,
      comments,
      operator
    );
    
    res.json({
      success: true,
      data: summary,
      message: '核算已拒绝，返回计算状态'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/export/data', (req, res) => {
  try {
    const { supplier_id, period } = req.query;
    const data = reconciliation.exportReconciliationData(supplier_id, period);
    
    res.json({
      success: true,
      data: data,
      record_count: data.length
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/statistics', (req, res) => {
  try {
    const { period } = req.query;
    const stats = reconciliation.getOverallStatistics(period);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
