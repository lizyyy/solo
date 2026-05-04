const express = require('express');
const router = express.Router();
const { generateMarkdownReport, generateScrapListCSV, generateRopeSummaryCSV } = require('../utils/exportUtils');

router.get('/markdown-report', (req, res) => {
  try {
    const markdown = generateMarkdownReport();
    const today = new Date().toISOString().split('T')[0];
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="绳索安全评估报告_${today}.md"`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/scrap-list', (req, res) => {
  try {
    const csv = generateScrapListCSV();
    const today = new Date().toISOString().split('T')[0];
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="报废清单_${today}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/rope-summary', (req, res) => {
  try {
    const csv = generateRopeSummaryCSV();
    const today = new Date().toISOString().split('T')[0];
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="绳索汇总_${today}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/json-report', (req, res) => {
  try {
    const { getAllRopesWithLatestAssessment, getScrappedRopes } = require('../utils/exportUtils');
    const { getRiskLabel, RISK_LEVELS } = require('../utils/riskCalculator');
    
    const ropes = getAllRopesWithLatestAssessment();
    const scrappedRopes = getScrappedRopes();
    
    const highRiskRopes = ropes.filter(r => 
      r.effective_risk_level === RISK_LEVELS.CRITICAL || 
      r.effective_risk_level === RISK_LEVELS.WARNING
    );
    const scrapRopes = ropes.filter(r => r.effective_risk_level === RISK_LEVELS.SCRAP);
    const cautionRopes = ropes.filter(r => r.effective_risk_level === RISK_LEVELS.CAUTION);
    const normalRopes = ropes.filter(r => !r.effective_risk_level || r.effective_risk_level === RISK_LEVELS.NORMAL);
    
    const report = {
      generated_at: new Date().toISOString(),
      summary: {
        total: ropes.length,
        scrap: scrapRopes.length,
        critical: highRiskRopes.filter(r => r.effective_risk_level === RISK_LEVELS.CRITICAL).length,
        warning: highRiskRopes.filter(r => r.effective_risk_level === RISK_LEVELS.WARNING).length,
        caution: cautionRopes.length,
        normal: normalRopes.length,
        scrapped_history: scrappedRopes.length
      },
      ropes: ropes.map(rope => ({
        id: rope.id,
        rope_number: rope.rope_number,
        brand: rope.brand,
        model: rope.model,
        purchase_date: rope.purchase_date,
        status: rope.status,
        risk_level: rope.effective_risk_level,
        risk_label: getRiskLabel(rope.effective_risk_level),
        total_energy_kj: rope.total_energy_kj,
        service_days: rope.service_days,
        wear_level: rope.current_wear_level,
        risk_factors: rope.risk_factors,
        has_review_decision: !!rope.review_decision
      })),
      risk_priority: [
        { level: RISK_LEVELS.SCRAP, label: getRiskLabel(RISK_LEVELS.SCRAP), ropes: scrapRopes },
        { level: RISK_LEVELS.CRITICAL, label: getRiskLabel(RISK_LEVELS.CRITICAL), ropes: highRiskRopes.filter(r => r.effective_risk_level === RISK_LEVELS.CRITICAL) },
        { level: RISK_LEVELS.WARNING, label: getRiskLabel(RISK_LEVELS.WARNING), ropes: highRiskRopes.filter(r => r.effective_risk_level === RISK_LEVELS.WARNING) },
        { level: RISK_LEVELS.CAUTION, label: getRiskLabel(RISK_LEVELS.CAUTION), ropes: cautionRopes },
        { level: RISK_LEVELS.NORMAL, label: getRiskLabel(RISK_LEVELS.NORMAL), ropes: normalRopes }
      ]
    };
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
