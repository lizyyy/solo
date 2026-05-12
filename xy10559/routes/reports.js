const express = require('express');
const router = express.Router();
const { store, enums } = require('../models/store');

router.get('/dashboard', (req, res) => {
  const stats = {
    totalCards: store.cards.length,
    activeCards: store.cards.filter(c => c.status === enums.CardStatus.ACTIVE).length,
    pausedCards: store.cards.filter(c => c.status === enums.CardStatus.PAUSED).length,
    suspendedCards: store.cards.filter(c => c.status === enums.CardStatus.SUSPENDED).length,
    overdueCards: store.cards.filter(c => c.isOverdue).length,
    totalTransactions: store.transactions.length,
    totalRevenue: store.transactions
      .filter(t => t.status === enums.TransactionStatus.SUCCESS)
      .reduce((sum, t) => sum + t.amount, 0),
    totalSyncs: store.gateSync.length,
    successfulSyncs: store.gateSync.filter(s => s.status === enums.SyncStatus.SUCCESS).length,
    failedSyncs: store.gateSync.filter(s => s.status === enums.SyncStatus.FAILED).length,
    unresolvedAnomalies: store.anomalies.filter(a => !a.resolved).length,
    gateWhitelistCount: Object.keys(store.gateStatus).filter(p => store.gateStatus[p].allowed).length
  };

  res.json({ success: true, stats });
});

router.get('/anomalies', (req, res) => {
  const { resolved } = req.query;
  let anomalies = [...store.anomalies];
  
  if (resolved !== undefined) {
    anomalies = anomalies.filter(a => a.resolved === (resolved === 'true'));
  }

  res.json({
    success: true,
    count: anomalies.length,
    anomalies
  });
});

router.post('/anomalies/:id/resolve', (req, res) => {
  const { operator, resolution } = req.body;
  try {
    const anomaly = gateSyncService.resolveAnomaly(req.params.id, operator, resolution);
    res.json({ success: true, anomaly });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/ledger', (req, res) => {
  const { cardId } = req.query;
  let transactions = [...store.transactions];
  
  if (cardId) {
    transactions = transactions.filter(t => t.cardId === cardId);
  }

  res.json({
    success: true,
    count: transactions.length,
    transactions
  });
});

router.get('/operations', (req, res) => {
  const { cardId, operator } = req.query;
  let logs = [...store.operationLogs];
  
  if (cardId) {
    logs = logs.filter(l => l.cardId === cardId);
  }
  if (operator) {
    logs = logs.filter(l => l.operator === operator);
  }

  res.json({
    success: true,
    count: logs.length,
    operations: logs
  });
});

router.get('/export', (req, res) => {
  const exportData = {
    exportTime: new Date().toISOString(),
    summary: {
      totalCards: store.cards.length,
      totalTransactions: store.transactions.length,
      totalSyncs: store.gateSync.length,
      totalAnomalies: store.anomalies.length
    },
    cards: store.cards,
    plateBindings: store.plateBindings,
    transactions: store.transactions,
    gateSync: store.gateSync,
    anomalies: store.anomalies,
    operationLogs: store.operationLogs,
    gateStatus: store.gateStatus
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=parking-report-${Date.now()}.json`);
  res.json(exportData);
});

const gateSyncService = require('../services/gateSyncService');

module.exports = router;
