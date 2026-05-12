const { store, enums, generateId, now } = require('../models/store');
const cardService = require('./cardService');

const gateSyncService = {
  shouldSyncCard: (card) => {
    return [enums.CardStatus.ACTIVE, enums.CardStatus.PAUSED, enums.CardStatus.SUSPENDED].includes(card.status);
  },

  syncCardToGate: (cardId, operator = 'system', forceRetry = false) => {
    const card = store.cards.find(c => c.id === cardId);
    if (!card) throw new Error('卡不存在');

    const activeBindings = store.plateBindings.filter(
      b => b.cardId === cardId && b.status === enums.PlateBindingStatus.ACTIVE
    );

    if (activeBindings.length === 0) {
      return { success: false, message: '卡没有绑定车牌', needSync: false };
    }

    const plates = activeBindings.map(b => b.plateNumber);
    const isAllowed = card.status === enums.CardStatus.ACTIVE && !card.isOverdue;

    const syncRecord = {
      id: generateId(),
      cardId,
      plates,
      action: isAllowed ? 'add_whitelist' : 'remove_whitelist',
      status: enums.SyncStatus.PENDING,
      retryCount: 0,
      createdAt: now(),
      lastAttempt: null,
      operator
    };

    store.gateSync.push(syncRecord);

    return gateSyncService._executeSync(syncRecord, isAllowed, plates);
  },

  _executeSync: (syncRecord, shouldAllow, plates) => {
    syncRecord.status = enums.SyncStatus.RETRYING;
    syncRecord.retryCount += 1;
    syncRecord.lastAttempt = now();

    const success = Math.random() > 0.2;

    if (success) {
      syncRecord.status = enums.SyncStatus.SUCCESS;
      plates.forEach(plate => {
        store.gateStatus[plate] = {
          allowed: shouldAllow,
          lastSync: now(),
          cardId: syncRecord.cardId
        };
      });
    } else {
      syncRecord.status = enums.SyncStatus.FAILED;
      syncRecord.errorMessage = '闸机接口超时';

      store.anomalies.push({
        id: generateId(),
        type: enums.AnomalyType.SYNC_FAILED,
        cardId: syncRecord.cardId,
        syncId: syncRecord.id,
        plates,
        timestamp: now(),
        resolved: false,
        message: `闸机同步失败: 车牌 ${plates.join(', ')}`
      });
    }

    return {
      syncRecord,
      success: success,
      gateStatus: plates.map(p => ({ plate: p, status: store.gateStatus[p] }))
    };
  },

  retryFailedSyncs: () => {
    const failedSyncs = store.gateSync.filter(
      s => s.status === enums.SyncStatus.FAILED && s.retryCount < 3
    );

    const results = [];
    failedSyncs.forEach(sync => {
      const card = store.cards.find(c => c.id === sync.cardId);
      if (!card) return;

      const isAllowed = card.status === enums.CardStatus.ACTIVE && !card.isOverdue;
      results.push(gateSyncService._executeSync(sync, isAllowed, sync.plates));
    });

    return results;
  },

  checkPlateAccess: (plateNumber) => {
    const gateStatus = store.gateStatus[plateNumber];
    const activeBindings = store.plateBindings.filter(
      b => b.plateNumber === plateNumber && b.status === enums.PlateBindingStatus.ACTIVE
    );

    if (activeBindings.length === 0) {
      return {
        allowed: false,
        reason: '未找到绑定的月卡',
        gateStatus: gateStatus || null
      };
    }

    const cards = activeBindings.map(b => store.cards.find(c => c.id === b.cardId)).filter(Boolean);
    const validCards = cards.filter(c => c.status === enums.CardStatus.ACTIVE && !c.isOverdue);

    if (validCards.length > 0) {
      const shouldBeAllowed = true;
      const actuallyAllowed = gateStatus && gateStatus.allowed;

      if (shouldBeAllowed && !actuallyAllowed) {
        store.anomalies.push({
          id: generateId(),
          type: enums.AnomalyType.ACCESS_DENIED,
          plateNumber,
          cardIds: validCards.map(c => c.id),
          timestamp: now(),
          resolved: false,
          message: `有效月卡但闸机白名单未同步: ${plateNumber}`
        });
      }

      return {
        allowed: actuallyAllowed,
        shouldBeAllowed,
        reason: actuallyAllowed ? '正常通行' : '闸机白名单未同步',
        validCards: validCards.map(c => ({ id: c.id, owner: c.ownerName, endDate: c.endDate })),
        gateStatus
      };
    }

    const overdueCards = cards.filter(c => c.isOverdue);
    if (overdueCards.length > 0) {
      return {
        allowed: false,
        reason: '月卡欠费冻结',
        overdueCards: overdueCards.map(c => ({ id: c.id, owner: c.ownerName })),
        gateStatus
      };
    }

    return {
      allowed: false,
      reason: '无有效月卡',
      cards: cards.map(c => ({ id: c.id, status: c.status })),
      gateStatus
    };
  },

  getSyncHistory: (cardId) => {
    return store.gateSync.filter(s => s.cardId === cardId);
  },

  getAllFailedSyncs: () => {
    return store.gateSync.filter(s => s.status === enums.SyncStatus.FAILED);
  },

  resolveAnomaly: (anomalyId, operator, resolution) => {
    const anomaly = store.anomalies.find(a => a.id === anomalyId);
    if (!anomaly) throw new Error('异常记录不存在');

    anomaly.resolved = true;
    anomaly.resolvedAt = now();
    anomaly.resolvedBy = operator;
    anomaly.resolution = resolution;

    return anomaly;
  }
};

module.exports = gateSyncService;
