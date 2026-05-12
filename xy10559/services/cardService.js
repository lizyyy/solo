const { store, enums, generateId, now } = require('../models/store');

const cardService = {
  createCard: (ownerName, phone, plateNumber, monthlyPrice, startDate, endDate, operator = 'system') => {
    const cardId = generateId();
    const card = {
      id: cardId,
      ownerName,
      phone,
      monthlyPrice,
      startDate,
      endDate,
      status: enums.CardStatus.ACTIVE,
      balance: 0,
      isOverdue: false,
      createdAt: now(),
      updatedAt: now(),
      history: []
    };

    const activePlates = store.plateBindings.filter(
      b => b.plateNumber === plateNumber && b.status === enums.PlateBindingStatus.ACTIVE
    );

    if (activePlates.length > 0) {
      store.anomalies.push({
        id: generateId(),
        type: enums.AnomalyType.PLATE_CONFLICT,
        plateNumber,
        conflictingCards: activePlates.map(b => b.cardId),
        newCardId: cardId,
        timestamp: now(),
        resolved: false
      });
      card.status = enums.CardStatus.DRAFT;
    }

    store.cards.push(card);
    cardService._logOperation(cardId, null, card, 'create_card', operator);

    if (card.status === enums.CardStatus.ACTIVE) {
      cardService.bindPlate(cardId, plateNumber, operator);
    }

    return card;
  },

  bindPlate: (cardId, plateNumber, operator = 'system') => {
    const card = store.cards.find(c => c.id === cardId);
    if (!card) throw new Error('卡不存在');

    const existingBindings = store.plateBindings.filter(
      b => b.cardId === cardId && b.status === enums.PlateBindingStatus.ACTIVE
    );
    existingBindings.forEach(b => {
      b.status = enums.PlateBindingStatus.HISTORICAL;
      b.endDate = now();
    });

    const activeConflict = store.plateBindings.find(
      b => b.plateNumber === plateNumber && b.status === enums.PlateBindingStatus.ACTIVE && b.cardId !== cardId
    );

    if (activeConflict) {
      store.anomalies.push({
        id: generateId(),
        type: enums.AnomalyType.PLATE_CONFLICT,
        plateNumber,
        existingCardId: activeConflict.cardId,
        newCardId: cardId,
        timestamp: now(),
        resolved: false,
        message: `车牌 ${plateNumber} 已绑定到卡 ${activeConflict.cardId}`
      });
    }

    const binding = {
      id: generateId(),
      cardId,
      plateNumber,
      status: enums.PlateBindingStatus.ACTIVE,
      startDate: now(),
      endDate: null
    };
    store.plateBindings.push(binding);

    cardService._logOperation(cardId, card, { ...card, currentPlate: plateNumber }, 'bind_plate', operator, {
      previousPlates: existingBindings.map(b => b.plateNumber),
      newPlate: plateNumber
    });

    return binding;
  },

  renewCard: (cardId, months, amount, operator = 'system') => {
    const card = store.cards.find(c => c.id === cardId);
    if (!card) throw new Error('卡不存在');

    const oldCard = JSON.parse(JSON.stringify(card));
    const currentEnd = new Date(card.endDate);
    const newEnd = new Date(currentEnd);
    newEnd.setMonth(newEnd.getMonth() + months);

    card.endDate = newEnd.toISOString().split('T')[0];
    card.updatedAt = now();

    if (card.status === enums.CardStatus.SUSPENDED && !card.isOverdue) {
      card.status = enums.CardStatus.ACTIVE;
    }

    const transaction = {
      id: generateId(),
      cardId,
      type: enums.TransactionType.RENEWAL,
      amount,
      months,
      status: enums.TransactionStatus.SUCCESS,
      timestamp: now(),
      operator
    };
    store.transactions.push(transaction);

    cardService._logOperation(cardId, oldCard, card, 'renew_card', operator, {
      months,
      amount,
      previousEnd: oldCard.endDate,
      newEnd: card.endDate
    });

    return { card, transaction };
  },

  pauseCard: (cardId, reason, operator = 'system') => {
    const card = store.cards.find(c => c.id === cardId);
    if (!card) throw new Error('卡不存在');
    if (card.status === enums.CardStatus.PAUSED) throw new Error('卡已暂停');

    const oldCard = JSON.parse(JSON.stringify(card));
    card.status = enums.CardStatus.PAUSED;
    card.pauseReason = reason;
    card.pausedAt = now();
    card.updatedAt = now();

    cardService._logOperation(cardId, oldCard, card, 'pause_card', operator, { reason });

    return card;
  },

  resumeCard: (cardId, operator = 'system') => {
    const card = store.cards.find(c => c.id === cardId);
    if (!card) throw new Error('卡不存在');
    if (card.status !== enums.CardStatus.PAUSED) throw new Error('卡不在暂停状态');

    const oldCard = JSON.parse(JSON.stringify(card));
    card.status = enums.CardStatus.ACTIVE;
    card.resumedAt = now();
    card.updatedAt = now();
    delete card.pauseReason;
    delete card.pausedAt;

    cardService._logOperation(cardId, oldCard, card, 'resume_card', operator);

    return card;
  },

  freezeForOverdue: (cardId, operator = 'system') => {
    const card = store.cards.find(c => c.id === cardId);
    if (!card) throw new Error('卡不存在');

    const oldCard = JSON.parse(JSON.stringify(card));
    card.status = enums.CardStatus.SUSPENDED;
    card.isOverdue = true;
    card.frozenAt = now();
    card.updatedAt = now();

    cardService._logOperation(cardId, oldCard, card, 'freeze_overdue', operator);

    return card;
  },

  getCard: (cardId) => {
    const card = store.cards.find(c => c.id === cardId);
    if (!card) return null;

    const activePlates = store.plateBindings.filter(
      b => b.cardId === cardId && b.status === enums.PlateBindingStatus.ACTIVE
    );

    const transactions = store.transactions.filter(t => t.cardId === cardId);
    const syncHistory = store.gateSync.filter(s => s.cardId === cardId);
    const logs = store.operationLogs.filter(l => l.cardId === cardId);

    return {
      ...card,
      currentPlates: activePlates.map(b => b.plateNumber),
      transactions,
      syncHistory,
      operationLogs: logs
    };
  },

  listCards: (filters = {}) => {
    let cards = [...store.cards];
    if (filters.status) {
      cards = cards.filter(c => c.status === filters.status);
    }
    if (filters.plateNumber) {
      const bindingCardIds = store.plateBindings
        .filter(b => b.plateNumber === filters.plateNumber)
        .map(b => b.cardId);
      cards = cards.filter(c => bindingCardIds.includes(c.id));
    }
    return cards;
  },

  _logOperation: (cardId, before, after, operation, operator, extra = {}) => {
    const diff = {
      before: before ? { status: before.status, endDate: before.endDate } : null,
      after: after ? { status: after.status, endDate: after.endDate } : null
    };

    store.operationLogs.push({
      id: generateId(),
      cardId,
      operation,
      operator,
      timestamp: now(),
      diff,
      extra,
      humanReadable: cardService._generateHumanReadable(operation, diff, extra)
    });
  },

  _generateHumanReadable: (operation, diff, extra) => {
    const messages = {
      create_card: '创建月卡',
      bind_plate: `绑定车牌: ${extra.newPlate}`,
      renew_card: `续费 ${extra.months} 个月，金额 ¥${extra.amount}，有效期延长至 ${extra.newEnd}`,
      pause_card: `暂停月卡，原因: ${extra.reason}`,
      resume_card: '恢复月卡使用',
      freeze_overdue: '因欠费冻结月卡',
      manual_correction: `人工修正: ${JSON.stringify(extra)}`
    };
    return messages[operation] || operation;
  },

  manualCorrection: (cardId, updates, operator, reason) => {
    const card = store.cards.find(c => c.id === cardId);
    if (!card) throw new Error('卡不存在');

    const oldCard = JSON.parse(JSON.stringify(card));
    Object.assign(card, updates);
    card.updatedAt = now();

    cardService._logOperation(cardId, oldCard, card, 'manual_correction', operator, {
      reason,
      changes: updates
    });

    return card;
  }
};

module.exports = cardService;
