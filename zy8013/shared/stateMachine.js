const { EVENT_TYPES, CARD_STATUSES } = require('./constants');
const { validateCard, validateEvent } = require('./types');

class StateMachine {
  constructor(initialState = {}) {
    this.cards = new Map();
    this.eventIds = new Set();
    this.sequence = 0;
    
    if (initialState.cards) {
      initialState.cards.forEach(card => {
        if (validateCard(card)) {
          this.cards.set(card.id, { ...card });
        }
      });
    }
    
    if (initialState.eventLog) {
      initialState.eventLog.forEach(event => {
        if (event.id) {
          this.eventIds.add(event.id);
        }
        if (event.sequence && event.sequence > this.sequence) {
          this.sequence = event.sequence;
        }
      });
    }
  }

  hasEvent(eventId) {
    return this.eventIds.has(eventId);
  }

  applyEvent(event) {
    if (!validateEvent(event)) {
      return { success: false, error: 'Invalid event' };
    }

    if (this.hasEvent(event.id)) {
      return { 
        success: true, 
        isDuplicate: true,
        message: 'Event already applied'
      };
    }

    let result;
    switch (event.type) {
      case EVENT_TYPES.CARD_CREATED:
        result = this.applyCardCreated(event);
        break;
      case EVENT_TYPES.CARD_MOVED:
        result = this.applyCardMoved(event);
        break;
      case EVENT_TYPES.CARD_UPDATED:
        result = this.applyCardUpdated(event);
        break;
      case EVENT_TYPES.CARD_DELETED:
        result = this.applyCardDeleted(event);
        break;
      default:
        return { success: false, error: `Unknown event type: ${event.type}` };
    }

    if (result.success) {
      this.eventIds.add(event.id);
      this.sequence++;
      return {
        ...result,
        sequence: this.sequence
      };
    }

    return result;
  }

  applyCardCreated(event) {
    const { payload } = event;
    if (!payload || !payload.cardId || !payload.title) {
      return { success: false, error: 'Invalid card_created payload' };
    }

    if (this.cards.has(payload.cardId)) {
      return { success: false, error: 'Card already exists' };
    }

    const card = {
      id: payload.cardId,
      title: payload.title,
      status: payload.status || CARD_STATUSES.TODO,
      assignee: payload.assignee || null,
      createdAt: event.timestamp,
      updatedAt: event.timestamp
    };

    if (!validateCard(card)) {
      return { success: false, error: 'Invalid card data' };
    }

    this.cards.set(card.id, card);
    return { success: true, card };
  }

  applyCardMoved(event) {
    const { payload } = event;
    if (!payload || !payload.cardId || !payload.newStatus) {
      return { success: false, error: 'Invalid card_moved payload' };
    }

    if (!this.cards.has(payload.cardId)) {
      return { success: false, error: 'Card not found' };
    }

    if (!Object.values(CARD_STATUSES).includes(payload.newStatus)) {
      return { success: false, error: 'Invalid status' };
    }

    const card = this.cards.get(payload.cardId);
    const oldStatus = card.status;
    card.status = payload.newStatus;
    card.updatedAt = event.timestamp;

    return { 
      success: true, 
      card, 
      oldStatus, 
      newStatus: payload.newStatus 
    };
  }

  applyCardUpdated(event) {
    const { payload } = event;
    if (!payload || !payload.cardId) {
      return { success: false, error: 'Invalid card_updated payload' };
    }

    if (!this.cards.has(payload.cardId)) {
      return { success: false, error: 'Card not found' };
    }

    const card = this.cards.get(payload.cardId);
    const updates = {};

    if (payload.title !== undefined) {
      updates.title = { old: card.title, new: payload.title };
      card.title = payload.title;
    }

    if (payload.assignee !== undefined) {
      updates.assignee = { old: card.assignee, new: payload.assignee };
      card.assignee = payload.assignee;
    }

    card.updatedAt = event.timestamp;

    return { success: true, card, updates };
  }

  applyCardDeleted(event) {
    const { payload } = event;
    if (!payload || !payload.cardId) {
      return { success: false, error: 'Invalid card_deleted payload' };
    }

    if (!this.cards.has(payload.cardId)) {
      return { 
        success: true, 
        isDuplicate: true,
        message: 'Card already deleted' 
      };
    }

    const card = this.cards.get(payload.cardId);
    this.cards.delete(payload.cardId);

    return { success: true, card };
  }

  getCardsArray() {
    return Array.from(this.cards.values());
  }

  getCardsMap() {
    const map = {};
    this.cards.forEach((card, id) => {
      map[id] = { ...card };
    });
    return map;
  }

  getCurrentSequence() {
    return this.sequence;
  }

  computeDiff(otherState) {
    const diffs = [];
    const otherCards = otherState.cards || {};
    const otherCardIds = new Set(Object.keys(otherCards));
    
    this.cards.forEach((card, cardId) => {
      otherCardIds.delete(cardId);
      const otherCard = otherCards[cardId];
      
      if (!otherCard) {
        diffs.push({
          type: 'card_missing',
          cardId,
          serverValue: card,
          clientValue: null
        });
        return;
      }
      
      ['title', 'status', 'assignee'].forEach(field => {
        if (card[field] !== otherCard[field]) {
          diffs.push({
            type: 'field_diff',
            cardId,
            field,
            serverValue: card[field],
            clientValue: otherCard[field]
          });
        }
      });
    });
    
    otherCardIds.forEach(cardId => {
      diffs.push({
        type: 'card_extra',
        cardId,
        serverValue: null,
        clientValue: otherCards[cardId]
      });
    });
    
    return diffs;
  }
}

function replayEvents(events, initialState = {}) {
  const sm = new StateMachine(initialState);
  const results = [];
  
  const sortedEvents = [...events].sort((a, b) => {
    if (a.sequence !== undefined && b.sequence !== undefined) {
      return a.sequence - b.sequence;
    }
    return a.timestamp - b.timestamp;
  });
  
  sortedEvents.forEach(event => {
    const result = sm.applyEvent(event);
    results.push({ event, result });
  });
  
  return {
    finalState: {
      cards: sm.getCardsArray()
    },
    results,
    sequence: sm.getCurrentSequence()
  };
}

module.exports = {
  StateMachine,
  replayEvents
};
