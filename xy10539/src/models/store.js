const { v4: uuidv4 } = require('uuid');

const store = {
  anchors: {},
  guilds: {},
  gifts: {},
  settlementRules: {},
  freezes: {},
  refunds: {},
  settlements: {},
  auditLogs: []
};

const STATUS = {
  SETTLEMENT: {
    CREATED: 'CREATED',
    PROCESSING: 'PROCESSING',
    PARTIAL: 'PARTIAL',
    COMPLETED: 'COMPLETED',
    FROZEN: 'FROZEN',
    FAILED: 'FAILED'
  },
  GIFT: {
    PENDING: 'PENDING',
    SETTLED: 'SETTLED',
    FROZEN: 'FROZEN',
    REFUNDED: 'REFUNDED'
  }
};

function createAnchor(data) {
  const id = uuidv4();
  store.anchors[id] = {
    id,
    name: data.name,
    guildId: data.guildId || null,
    status: data.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    settlementHistory: []
  };
  return store.anchors[id];
}

function createGuild(data) {
  const id = uuidv4();
  store.guilds[id] = {
    id,
    name: data.name,
    status: data.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    anchors: [],
    ratioHistory: []
  };
  return store.guilds[id];
}

function createGift(data) {
  const giftKey = `${data.streamerId}-${data.giftType}-${data.amount}-${data.timestamp}`;
  
  if (store.gifts[data.id]) {
    return store.gifts[data.id];
  }
  
  const id = data.id || uuidv4();
  store.gifts[id] = {
    id,
    streamerId: data.streamerId,
    guildId: data.guildId,
    giftType: data.giftType,
    amount: Number(data.amount),
    unitPrice: Number(data.unitPrice) || 1,
    totalValue: Number(data.amount) * (Number(data.unitPrice) || 1),
    timestamp: data.timestamp,
    settlementPeriod: data.settlementPeriod,
    status: STATUS.GIFT.PENDING,
    settlementId: null,
    isIdempotent: data.isIdempotent || false,
    idempotencyKey: giftKey,
    createdAt: new Date().toISOString()
  };
  
  return store.gifts[id];
}

function createSettlementRule(data) {
  const id = uuidv4();
  store.settlementRules[id] = {
    id,
    anchorId: data.anchorId || null,
    guildId: data.guildId || null,
    effectiveDate: data.effectiveDate,
    endDate: data.endDate || null,
    anchorRatio: Number(data.anchorRatio),
    guildRatio: Number(data.guildRatio),
    platformRatio: Number(data.platformRatio),
    isActive: true,
    createdAt: new Date().toISOString()
  };
  
  if (data.guildId && store.guilds[data.guildId]) {
    store.guilds[data.guildId].ratioHistory.push({
      ruleId: id,
      effectiveDate: data.effectiveDate,
      anchorRatio: data.anchorRatio,
      guildRatio: data.guildRatio
    });
  }
  
  return store.settlementRules[id];
}

function createFreeze(data) {
  const id = uuidv4();
  store.freezes[id] = {
    id,
    anchorId: data.anchorId,
    reason: data.reason,
    freezeStart: data.freezeStart,
    freezeEnd: data.freezeEnd || null,
    status: 'ACTIVE',
    affectedGifts: [],
    affectedAmount: 0,
    createdAt: new Date().toISOString()
  };
  return store.freezes[id];
}

function createRefund(data) {
  const id = uuidv4();
  store.refunds[id] = {
    id,
    giftId: data.giftId,
    originalPeriod: data.originalPeriod,
    refundPeriod: data.refundPeriod,
    amount: Number(data.amount),
    reason: data.reason,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };
  return store.refunds[id];
}

function createSettlement(period, anchorId) {
  const id = uuidv4();
  store.settlements[id] = {
    id,
    period,
    anchorId,
    status: STATUS.SETTLEMENT.CREATED,
    giftIds: [],
    refundIds: [],
    freezeIds: [],
    calculations: {
      totalGiftValue: 0,
      anchorShare: 0,
      guildShare: 0,
      platformShare: 0,
      refundAdjustment: 0,
      freezeAmount: 0,
      previousCarryover: 0,
      netPayable: 0,
      nextCarryover: 0
    },
    history: [],
    manualCorrections: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return store.settlements[id];
}

function addAuditLog(action, entityType, entityId, details, operator = 'SYSTEM') {
  store.auditLogs.push({
    id: uuidv4(),
    action,
    entityType,
    entityId,
    details,
    operator,
    timestamp: new Date().toISOString()
  });
}

function findSettlementByPeriodAndAnchor(period, anchorId) {
  return Object.values(store.settlements).find(
    s => s.period === period && s.anchorId === anchorId
  );
}

function findActiveFreeze(anchorId, timestamp) {
  return Object.values(store.freezes).find(f => {
    if (f.anchorId !== anchorId || f.status !== 'ACTIVE') return false;
    const freezeStart = new Date(f.freezeStart);
    const freezeEnd = f.freezeEnd ? new Date(f.freezeEnd) : new Date('9999-12-31');
    const checkTime = new Date(timestamp);
    return checkTime >= freezeStart && checkTime <= freezeEnd;
  });
}

function findActiveRule(anchorId, guildId, timestamp) {
  const rules = Object.values(store.settlementRules).filter(rule => {
    if (!rule.isActive) return false;
    const effectiveDate = new Date(rule.effectiveDate);
    const endDate = rule.endDate ? new Date(rule.endDate) : new Date('9999-12-31');
    const checkTime = new Date(timestamp);
    
    if (checkTime < effectiveDate || checkTime > endDate) return false;
    
    if (rule.anchorId && rule.anchorId !== anchorId) return false;
    if (rule.guildId && rule.guildId !== guildId) return false;
    
    return true;
  });
  
  rules.sort((a, b) => {
    if (a.anchorId && !b.anchorId) return -1;
    if (!a.anchorId && b.anchorId) return 1;
    return new Date(b.effectiveDate) - new Date(a.effectiveDate);
  });
  
  return rules[0];
}

function getPreviousSettlement(anchorId, currentPeriod) {
  const settlements = Object.values(store.settlements)
    .filter(s => s.anchorId === anchorId && s.period < currentPeriod)
    .sort((a, b) => b.period.localeCompare(a.period));
  
  return settlements[0];
}

module.exports = {
  store,
  STATUS,
  createAnchor,
  createGuild,
  createGift,
  createSettlementRule,
  createFreeze,
  createRefund,
  createSettlement,
  addAuditLog,
  findSettlementByPeriodAndAnchor,
  findActiveFreeze,
  findActiveRule,
  getPreviousSettlement
};
