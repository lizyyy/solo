const express = require('express');
const router = express.Router();
const store = require('../store/dataStore');
const mergeService = require('../services/mergeService');

router.get('/', (req, res) => {
  try {
    const { status, search } = req.query;
    const transactions = store.getMergeTransactions({ status, search });
    const enriched = transactions.map(t => {
      const identities = store.getExternalIdentities().filter(i => 
        t.identityIds && t.identityIds.includes(i.id)
      );
      const evidences = store.getMergeEvidences({ transactionId: t.id });
      const conflicts = store.getConflictFields({ transactionId: t.id });
      return { ...t, identities, evidences, conflicts };
    });
    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const transaction = store.getMergeTransactionById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, error: '合并事务不存在' });
    }
    const identities = store.getExternalIdentities().filter(i => 
      transaction.identityIds && transaction.identityIds.includes(i.id)
    );
    const evidences = store.getMergeEvidences({ transactionId: transaction.id });
    const conflicts = store.getConflictFields({ transactionId: transaction.id });
    const impacts = store.getImpactScopes({ transactionId: transaction.id });
    res.json({ 
      success: true, 
      data: { ...transaction, identities, evidences, conflicts, impacts } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { identityIds, reason, operator } = req.body;
    if (!identityIds || identityIds.length < 2) {
      return res.status(400).json({ success: false, error: '至少需要2个身份ID' });
    }
    const result = mergeService.initiateMerge(identityIds, reason, operator || 'system');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/approve', (req, res) => {
  try {
    const { operator } = req.body;
    const result = mergeService.approveMerge(req.params.id, operator || 'system');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/execute', (req, res) => {
  try {
    const { operator, resolutionStrategy } = req.body;
    const result = mergeService.executeMerge(req.params.id, operator || 'system', resolutionStrategy);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/undo', (req, res) => {
  try {
    const { operator, reason } = req.body;
    const result = mergeService.undoMerge(req.params.id, operator || 'system', reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/conflicts/:conflictId/resolve', (req, res) => {
  try {
    const { resolution, operator } = req.body;
    const result = mergeService.resolveConflict(
      req.params.conflictId, 
      resolution, 
      operator || 'system'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;