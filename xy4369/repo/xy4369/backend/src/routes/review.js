const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabase } = require('../database');
const { createReviewDecision, getRiskLabel, RISK_LEVELS } = require('../utils/riskCalculator');

router.post('/decision', (req, res) => {
  try {
    const { assessment_id, new_risk_level, decision_type, reviewer_name, review_notes, is_scrapped } = req.body;
    
    if (!assessment_id || !new_risk_level || !decision_type) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: assessment_id, new_risk_level, decision_type'
      });
    }
    
    const validRiskLevels = Object.values(RISK_LEVELS);
    if (!validRiskLevels.includes(new_risk_level)) {
      return res.status(400).json({
        success: false,
        error: `无效的风险等级。有效等级: ${validRiskLevels.join(', ')}`
      });
    }
    
    const result = createReviewDecision(
      assessment_id,
      new_risk_level,
      decision_type,
      reviewer_name,
      review_notes,
      is_scrapped || false
    );
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: '评估记录不存在'
      });
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/decisions/:assessmentId', (req, res) => {
  try {
    const db = getDatabase();
    const { assessmentId } = req.params;
    
    const result = db.exec(`
      SELECT * FROM review_decisions
      WHERE risk_assessment_id = ?
      ORDER BY review_date DESC
    `, [assessmentId]);
    
    const decisions = [];
    
    if (result.length > 0) {
      const columns = result[0].columns;
      for (const row of result[0].values) {
        const decision = {};
        columns.forEach((col, index) => {
          decision[col] = row[index];
        });
        decision.original_risk_label = getRiskLabel(decision.original_risk_level);
        decision.new_risk_label = getRiskLabel(decision.new_risk_level);
        decisions.push(decision);
      }
    }
    
    res.json({
      success: true,
      data: decisions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/scrap-history', (req, res) => {
  try {
    const db = getDatabase();
    
    const result = db.exec(`
      SELECT sd.*, r.rope_number, r.brand, r.model
      FROM scrap_decisions sd
      JOIN ropes r ON sd.rope_id = r.id
      ORDER BY sd.decision_date DESC
    `);
    
    const history = [];
    
    if (result.length > 0) {
      const columns = result[0].columns;
      for (const row of result[0].values) {
        const item = {};
        columns.forEach((col, index) => {
          item[col] = row[index];
        });
        
        if (item.risk_factors_at_scrap) {
          try {
            item.risk_factors_at_scrap = JSON.parse(item.risk_factors_at_scrap);
          } catch (e) {
            item.risk_factors_at_scrap = [];
          }
        }
        
        history.push(item);
      }
    }
    
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

router.get('/risk-levels', (req, res) => {
  res.json({
    success: true,
    data: {
      risk_levels: [
        { value: RISK_LEVELS.NORMAL, label: getRiskLabel(RISK_LEVELS.NORMAL) },
        { value: RISK_LEVELS.CAUTION, label: getRiskLabel(RISK_LEVELS.CAUTION) },
        { value: RISK_LEVELS.WARNING, label: getRiskLabel(RISK_LEVELS.WARNING) },
        { value: RISK_LEVELS.CRITICAL, label: getRiskLabel(RISK_LEVELS.CRITICAL) },
        { value: RISK_LEVELS.SCRAP, label: getRiskLabel(RISK_LEVELS.SCRAP) }
      ],
      decision_types: [
        { value: 'confirm', label: '确认风险' },
        { value: 'downgrade', label: '降低风险等级' },
        { value: 'upgrade', label: '提高风险等级' },
        { value: 'scrap', label: '判定报废' }
      ]
    }
  });
});

module.exports = router;
