const express = require('express');
const router = express.Router();
const store = require('../store/dataStore');

router.get('/', (req, res) => {
  try {
    const { entityId, action, limit } = req.query;
    let logs = store.getAuditLogs({ entityId, action });
    if (limit) {
      logs = logs.slice(0, parseInt(limit));
    }
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/statistics', (req, res) => {
  try {
    const identities = store.getExternalIdentities();
    const merged = identities.filter(i => i.masterCustomerId);
    const transactions = store.getMergeTransactions();
    const masters = store.getMasterCustomers();
    
    const stats = {
      totalIdentities: identities.length,
      mergedIdentities: merged.length,
      unmergedIdentities: identities.length - merged.length,
      totalMasterCustomers: masters.length,
      totalTransactions: transactions.length,
      transactionsByStatus: {
        pending: transactions.filter(t => t.status === 'pending').length,
        approved: transactions.filter(t => t.status === 'approved').length,
        completed: transactions.filter(t => t.status === 'completed').length,
        failed: transactions.filter(t => t.status === 'failed').length,
        undone: transactions.filter(t => t.status === 'undone').length
      },
      identitiesBySource: identities.reduce((acc, i) => {
        acc[i.source] = (acc[i.source] || 0) + 1;
        return acc;
      }, {})
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;