const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabase } = require('../database');
const { assessRopeRisk, getRopeTimeline, getAllRopesWithRisk, getRiskLabel } = require('../utils/riskCalculator');

router.get('/', (req, res) => {
  try {
    const ropes = getAllRopesWithRisk();
    res.json({
      success: true,
      data: ropes.map(rope => ({
        id: rope.id,
        rope_number: rope.rope_number,
        brand: rope.brand,
        model: rope.model,
        purchase_date: rope.purchase_date,
        length_m: rope.length_m,
        diameter_mm: rope.diameter_mm,
        wear_level: rope.wear_level,
        status: rope.status,
        notes: rope.notes,
        latest_assessment: rope.latest_assessment ? {
          id: rope.latest_assessment.id,
          assessment_date: rope.latest_assessment.assessment_date,
          total_energy_kj: rope.latest_assessment.total_energy_kj,
          service_days: rope.latest_assessment.service_days,
          current_wear_level: rope.latest_assessment.current_wear_level,
          effective_risk_level: rope.latest_assessment.effective_risk_level,
          effective_risk_label: getRiskLabel(rope.latest_assessment.effective_risk_level),
          risk_factors: rope.latest_assessment.risk_factors,
          review_decision: rope.latest_assessment.review_decision
        } : null
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const result = db.exec(`
      SELECT * FROM ropes WHERE id = ?
    `, [id]);
    
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({
        success: false,
        error: '绳索不存在'
      });
    }
    
    const columns = result[0].columns;
    const row = result[0].values[0];
    const rope = {};
    columns.forEach((col, index) => {
      rope[col] = row[index];
    });
    
    res.json({
      success: true,
      data: rope
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/timeline', (req, res) => {
  try {
    const { id } = req.params;
    const timeline = getRopeTimeline(parseInt(id));
    
    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/assess', (req, res) => {
  try {
    const { id } = req.params;
    const assessment = assessRopeRisk(parseInt(id));
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: '绳索不存在'
      });
    }
    
    res.json({
      success: true,
      data: assessment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/assess-all', async (req, res) => {
  try {
    const db = getDatabase();
    const ropesResult = db.exec(`SELECT id FROM ropes WHERE status != 'scrapped'`);
    
    const results = [];
    
    if (ropesResult.length > 0) {
      for (const row of ropesResult[0].values) {
        const ropeId = row[0];
        const assessment = assessRopeRisk(ropeId);
        results.push({
          rope_id: ropeId,
          assessment: assessment
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        assessed: results.length,
        details: results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { brand, model, purchase_date, length_m, diameter_mm, wear_level, status, notes } = req.body;
    
    const existing = db.exec(`SELECT id FROM ropes WHERE id = ?`, [id]);
    
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({
        success: false,
        error: '绳索不存在'
      });
    }
    
    db.run(`
      UPDATE ropes SET
        brand = ?,
        model = ?,
        purchase_date = ?,
        length_m = ?,
        diameter_mm = ?,
        wear_level = ?,
        status = ?,
        notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      brand,
      model,
      purchase_date,
      length_m,
      diameter_mm,
      wear_level,
      status || 'active',
      notes,
      id
    ]);
    
    saveDatabase();
    
    res.json({
      success: true,
      data: { id }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
