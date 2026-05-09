const express = require('express');
const router = express.Router();
const dataStore = require('../dataStore');

router.post('/detect', (req, res) => {
  const { threshold = 5, operator } = req.body;
  const groups = dataStore.detectDuplicates(threshold, operator);
  
  res.json({
    message: `检测到 ${groups.length} 组重复记录`,
    groups: groups.map(group => {
      const inspections = group.inspections.map(id => dataStore.getInspectionById(id)).filter(Boolean);
      return {
        id: group.id,
        status: group.status,
        count: group.inspections.length,
        suggestedPrimary: group.suggestedPrimary,
        inspections: inspections.map(i => ({
          id: i.id,
          team: i.team,
          looseness: i.looseness,
          settlement: i.settlement,
          riskScore: i.riskScore,
          riskLevel: i.riskLevel
        })),
        createdAt: group.createdAt
      };
    })
  });
});

router.get('/pending', (req, res) => {
  const pending = dataStore.getPendingMerges();
  
  res.json({
    count: pending.length,
    groups: pending.map(group => {
      const inspections = group.inspections.map(id => dataStore.getInspectionById(id)).filter(Boolean);
      const primary = inspections.find(i => i.id === group.suggestedPrimary);
      
      return {
        id: group.id,
        suggestedPrimary: primary ? {
          id: primary.id,
          team: primary.team,
          description: primary.description,
          riskScore: primary.riskScore,
          riskLevel: primary.riskLevel
        } : null,
        others: inspections.filter(i => i.id !== group.suggestedPrimary).map(i => ({
          id: i.id,
          team: i.team,
          description: i.description,
          riskScore: i.riskScore,
          riskLevel: i.riskLevel
        })),
        inspectionCount: group.inspections.length,
        createdAt: group.createdAt
      };
    })
  });
});

router.post('/:groupId/confirm', (req, res) => {
  const { groupId } = req.params;
  const { primaryId, operator } = req.body;
  
  if (!primaryId) {
    return res.status(400).json({ error: '需要指定主记录 primaryId' });
  }
  
  const result = dataStore.confirmMerge(groupId, primaryId, operator);
  
  if (!result) {
    return res.status(404).json({ error: '合并组不存在或已处理' });
  }
  
  res.json({
    message: '合并完成',
    primary: result.primary,
    mergedCount: result.mergedCount
  });
});

router.get('/summary', (req, res) => {
  const allGroups = dataStore.getAllMerges();
  const pending = allGroups.filter(g => g.status === 'pending');
  const merged = allGroups.filter(g => g.status === 'merged');
  
  res.json({
    total: allGroups.length,
    pending: pending.length,
    merged: merged.length,
    byTeam: {}
  });
});

module.exports = router;
