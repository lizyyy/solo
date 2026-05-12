const express = require('express');
const router = express.Router();
const {
  store,
  createAnchor,
  createGuild,
  createSettlementRule,
  createFreeze,
  createRefund,
  addAuditLog,
  findSettlementByPeriodAndAnchor
} = require('../models/store');
const {
  processGiftWithIdempotency,
  processGiftToSettlement,
  processRefund,
  finalizeSettlement,
  manualCorrect,
  generateSettlementReport,
  generateAnchorExplanationReport
} = require('../engine/settlementEngine');

router.get('/', (req, res) => {
  res.json({
    name: '直播礼物分账 API',
    version: '1.0.0',
    endpoints: {
      anchors: '/api/anchors',
      guilds: '/api/guilds',
      gifts: '/api/gifts',
      rules: '/api/rules',
      freezes: '/api/freezes',
      refunds: '/api/refunds',
      settlements: '/api/settlements',
      reports: '/api/reports'
    }
  });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/anchors', (req, res) => {
  try {
    const anchor = createAnchor(req.body);
    res.status(201).json(anchor);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/anchors', (req, res) => {
  res.json(Object.values(store.anchors));
});

router.get('/anchors/:id', (req, res) => {
  const anchor = store.anchors[req.params.id];
  if (!anchor) return res.status(404).json({ error: 'Anchor not found' });
  res.json(anchor);
});

router.post('/guilds', (req, res) => {
  try {
    const guild = createGuild(req.body);
    res.status(201).json(guild);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/guilds', (req, res) => {
  res.json(Object.values(store.guilds));
});

router.get('/guilds/:id', (req, res) => {
  const guild = store.guilds[req.params.id];
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  res.json(guild);
});

router.post('/rules', (req, res) => {
  try {
    const rule = createSettlementRule(req.body);
    res.status(201).json(rule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/rules', (req, res) => {
  res.json(Object.values(store.settlementRules));
});

router.post('/gifts', (req, res) => {
  try {
    const result = processGiftWithIdempotency(req.body);
    const statusCode = result.isDuplicate ? 200 : 201;
    
    let settlement = null;
    if (!result.isDuplicate) {
      settlement = processGiftToSettlement(result.gift);
    }
    
    res.status(statusCode).json({
      gift: result.gift,
      isDuplicate: result.isDuplicate,
      settlement: settlement
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/gifts', (req, res) => {
  res.json(Object.values(store.gifts));
});

router.get('/gifts/:id', (req, res) => {
  const gift = store.gifts[req.params.id];
  if (!gift) return res.status(404).json({ error: 'Gift not found' });
  res.json(gift);
});

router.post('/freezes', (req, res) => {
  try {
    const freeze = createFreeze(req.body);
    res.status(201).json(freeze);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/freezes', (req, res) => {
  res.json(Object.values(store.freezes));
});

router.post('/refunds', (req, res) => {
  try {
    const refund = createRefund(req.body);
    const settlement = processRefund(refund);
    res.status(201).json({ refund, settlement });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/refunds', (req, res) => {
  res.json(Object.values(store.refunds));
});

router.post('/settlements/create', (req, res) => {
  try {
    const { period, anchorId } = req.body;
    const existing = findSettlementByPeriodAndAnchor(period, anchorId);
    if (existing) {
      return res.status(200).json(existing);
    }
    
    const { createSettlement } = require('../models/store');
    const settlement = createSettlement(period, anchorId);
    res.status(201).json(settlement);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/settlements/:id/finalize', (req, res) => {
  try {
    const settlement = finalizeSettlement(req.params.id);
    res.json(settlement);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/settlements/:id/correct', (req, res) => {
  try {
    const { changes, operator } = req.body;
    const correction = manualCorrect(req.params.id, changes, operator || 'ADMIN');
    res.json({
      correction,
      settlement: store.settlements[req.params.id]
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/settlements', (req, res) => {
  const { period, anchorId, status } = req.query;
  let settlements = Object.values(store.settlements);
  
  if (period) settlements = settlements.filter(s => s.period === period);
  if (anchorId) settlements = settlements.filter(s => s.anchorId === anchorId);
  if (status) settlements = settlements.filter(s => s.status === status);
  
  res.json(settlements);
});

router.get('/settlements/:id', (req, res) => {
  const settlement = store.settlements[req.params.id];
  if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
  res.json(settlement);
});

router.get('/settlements/:id/history', (req, res) => {
  const settlement = store.settlements[req.params.id];
  if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
  res.json({
    settlementId: req.params.id,
    history: settlement.history
  });
});

router.get('/reports/settlement/:id', (req, res) => {
  try {
    const report = generateSettlementReport(req.params.id);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reports/anchor-explanation/:id', (req, res) => {
  try {
    const report = generateAnchorExplanationReport(req.params.id);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reports/anchor-explanation/:id/text', (req, res) => {
  try {
    const report = generateAnchorExplanationReport(req.params.id);
    let textReport = `\n========================================\n`;
    textReport += `  主播账单说明报告\n`;
    textReport += `========================================\n\n`;
    
    for (const section of report.explanation) {
      textReport += `【${section.title}】\n`;
      textReport += `${section.content}\n\n`;
    }
    
    textReport += `========================================\n`;
    textReport += `  结算单ID: ${report.settlementId}\n`;
    textReport += `  生成时间: ${report.generatedAt}\n`;
    textReport += `========================================\n`;
    
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(textReport);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/audit-logs', (req, res) => {
  const { entityType, entityId } = req.query;
  let logs = [...store.auditLogs];
  
  if (entityType) logs = logs.filter(l => l.entityType === entityType);
  if (entityId) logs = logs.filter(l => l.entityId === entityId);
  
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(logs);
});

router.get('/exceptions', (req, res) => {
  const failedSettlements = Object.values(store.settlements).filter(
    s => s.status === 'FAILED'
  );
  
  const exceptions = [];
  for (const settlement of failedSettlements) {
    const lastStatusChange = settlement.history
      .filter(h => h.event === 'STATUS_CHANGE' && h.details.to === 'FAILED')
      .pop();
    
    exceptions.push({
      settlementId: settlement.id,
      period: settlement.period,
      anchorId: settlement.anchorId,
      reason: lastStatusChange?.details.reason || 'Unknown',
      history: settlement.history
    });
  }
  
  res.json(exceptions);
});

router.post('/exceptions/:id/retry', (req, res) => {
  try {
    const settlement = store.settlements[req.params.id];
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
    
    if (settlement.status !== 'FAILED') {
      return res.status(400).json({ error: 'Settlement is not in FAILED status' });
    }
    
    const { createSettlementRule } = require('../models/store');
    
    const anchor = store.anchors[settlement.anchorId];
    if (!anchor) {
      return res.status(400).json({ error: 'Anchor not found, cannot retry' });
    }
    
    const retryHistory = settlement.history.filter(h => h.event === 'RETRY_ATTEMPT').length;
    if (retryHistory >= 3) {
      return res.status(400).json({ 
        error: 'Max retry attempts (3) reached. Please use manual correction.' 
      });
    }
    
    addAuditLog('RETRY_ATTEMPT', 'SETTLEMENT', settlement.id, {
      retryCount: retryHistory + 1
    });
    
    settlement.history.push({
      event: 'RETRY_ATTEMPT',
      details: { retryCount: retryHistory + 1 },
      operator: 'SYSTEM',
      timestamp: new Date().toISOString(),
      statusBefore: settlement.status
    });
    
    const newRule = createSettlementRule({
      guildId: anchor.guildId,
      effectiveDate: '2024-01-01T00:00:00.000Z',
      anchorRatio: 0.50,
      guildRatio: 0.20,
      platformRatio: 0.30
    });
    
    settlement.history.push({
      event: 'RULE_AUTO_APPLIED',
      details: { ruleId: newRule.id, message: 'Default rule applied for retry' },
      operator: 'SYSTEM',
      timestamp: new Date().toISOString(),
      statusBefore: settlement.status
    });
    
    for (const giftId of settlement.giftIds) {
      const gift = store.gifts[giftId];
      if (gift) {
        const result = processGiftToSettlement(gift);
        Object.assign(settlement, result);
      }
    }
    
    const finalized = finalizeSettlement(settlement.id);
    
    res.json({
      message: 'Retry successful',
      retryCount: retryHistory + 1,
      settlement: finalized
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/dashboard', (req, res) => {
  const settlements = Object.values(store.settlements);
  const gifts = Object.values(store.gifts);
  const anchors = Object.values(store.anchors);
  const guilds = Object.values(store.guilds);
  const freezes = Object.values(store.freezes);
  
  const totalGiftValue = gifts.reduce((sum, g) => sum + g.totalValue, 0);
  const totalPayable = settlements.reduce(
    (sum, s) => sum + s.calculations.netPayable, 0
  );
  const totalFrozen = settlements.reduce(
    (sum, s) => sum + s.calculations.freezeAmount, 0
  );
  
  const statusStats = {};
  for (const s of settlements) {
    statusStats[s.status] = (statusStats[s.status] || 0) + 1;
  }
  
  res.json({
    summary: {
      anchors: anchors.length,
      guilds: guilds.length,
      gifts: gifts.length,
      settlements: settlements.length,
      freezes: freezes.length,
      totalGiftValue,
      totalPayable,
      totalFrozen
    },
    settlementStatus: statusStats,
    recentSettlements: settlements
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10)
      .map(s => ({
        id: s.id,
        period: s.period,
        anchorId: s.anchorId,
        status: s.status,
        netPayable: s.calculations.netPayable,
        updatedAt: s.updatedAt
      }))
  });
});

module.exports = router;
