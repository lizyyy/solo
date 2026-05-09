const express = require('express');
const router = express.Router();
const dataStore = require('../dataStore');

router.post('/calculate', (req, res) => {
  const { operator } = req.body;
  const results = dataStore.calculateAllRisks(operator);
  res.json({
    message: '风险评分完成',
    results,
    summary: {
      critical: results.filter(r => r.level === 'critical').length,
      high: results.filter(r => r.level === 'high').length,
      medium: results.filter(r => r.level === 'medium').length,
      low: results.filter(r => r.level === 'low').length
    }
  });
});

router.get('/summary', (req, res) => {
  const inspections = dataStore.getAllInspections();
  const scored = inspections.filter(i => i.riskScore !== null);
  
  res.json({
    total: inspections.length,
    scored: scored.length,
    byLevel: {
      critical: scored.filter(i => i.riskLevel === 'critical').length,
      high: scored.filter(i => i.riskLevel === 'high').length,
      medium: scored.filter(i => i.riskLevel === 'medium').length,
      low: scored.filter(i => i.riskLevel === 'low').length
    },
    topRisks: scored
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5)
      .map(i => ({
        id: i.id,
        team: i.team,
        score: i.riskScore,
        level: i.riskLevel,
        factors: i.riskFactors
      }))
  });
});

router.get('/suggestions', (req, res) => {
  const inspections = dataStore.getAllInspections();
  const suggestions = [];

  const critical = inspections.filter(i => i.riskLevel === 'critical');
  const high = inspections.filter(i => i.riskLevel === 'high');

  if (critical.length > 0) {
    suggestions.push({
      type: 'urgent',
      priority: 1,
      message: `有 ${critical.length} 条高危记录需要立即处理`,
      action: '建议立即派出应急队伍处理',
      records: critical.map(i => ({ id: i.id, team: i.team, score: i.riskScore }))
    });
  }

  if (high.length > 0) {
    suggestions.push({
      type: 'warning',
      priority: 2,
      message: `有 ${high.length} 条高风险记录需要处理`,
      action: '建议列入本周处理计划',
      records: high.map(i => ({ id: i.id, team: i.team, score: i.riskScore }))
    });
  }

  const scored = inspections.filter(i => i.riskScore === null);
  if (scored.length > 0) {
    suggestions.push({
      type: 'info',
      priority: 3,
      message: `有 ${scored.length} 条记录未进行风险评分`,
      action: '建议先执行风险评分',
      records: scored.map(i => ({ id: i.id, team: i.team }))
    });
  }

  res.json(suggestions.sort((a, b) => a.priority - b.priority));
});

module.exports = router;
