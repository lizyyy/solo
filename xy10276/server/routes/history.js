const express = require('express');
const router = express.Router();
const dataStore = require('../dataStore');

router.get('/inspection/:id', (req, res) => {
  const history = dataStore.getHistory('inspection', req.params.id);
  res.json({
    entityType: 'inspection',
    entityId: req.params.id,
    count: history.length,
    history: history.map(h => ({
      id: h.id,
      action: h.action,
      operator: h.operator,
      reason: h.reason,
      timestamp: h.timestamp,
      before: h.before,
      after: h.after,
      changes: h.before && h.after ? extractChanges(h.before, h.after) : null
    }))
  });
});

router.get('/merge/:id', (req, res) => {
  const history = dataStore.getHistory('merge_group', req.params.id);
  res.json({
    entityType: 'merge_group',
    entityId: req.params.id,
    count: history.length,
    history
  });
});

router.get('/risk/:id', (req, res) => {
  const history = dataStore.getHistory('risk', req.params.id);
  res.json({
    entityType: 'risk',
    entityId: req.params.id,
    count: history.length,
    history
  });
});

router.get('/status', (req, res) => {
  const statusHistory = dataStore.getStatusHistory();
  res.json({
    count: statusHistory.length,
    history: statusHistory.slice(-20)
  });
});

router.get('/all', (req, res) => {
  const all = dataStore.getHistory();
  res.json({
    count: all.length,
    history: all.slice(-50)
  });
});

function extractChanges(before, after) {
  const changes = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  
  keys.forEach(key => {
    if (['createdAt', 'updatedAt', 'id'].includes(key)) return;
    const b = JSON.stringify(before?.[key]);
    const a = JSON.stringify(after?.[key]);
    if (b !== a) {
      changes[key] = { before: before?.[key], after: after?.[key] };
    }
  });
  
  return Object.keys(changes).length > 0 ? changes : null;
}

module.exports = router;
