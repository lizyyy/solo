const { CARD_STATUSES, EVENT_TYPES } = require('./constants');

function createCard({ id, title, status = CARD_STATUSES.TODO, assignee = null, createdAt = Date.now() }) {
  return {
    id,
    title,
    status,
    assignee,
    createdAt,
    updatedAt: createdAt
  };
}

function createEvent({
  id,
  type,
  roomId,
  payload,
  clientId,
  timestamp = Date.now(),
  sequence = null
}) {
  return {
    id,
    type,
    roomId,
    payload,
    clientId,
    timestamp,
    sequence,
    receivedAt: timestamp
  };
}

function createRoom({ id, name, cards = [], eventLog = [], members = [] }) {
  return {
    id,
    name,
    cards,
    eventLog,
    members,
    createdAt: Date.now(),
    lastEventAt: Date.now()
  };
}

function createClientState({
  clientId,
  roomId,
  cards = {},
  lastEventSequence = 0,
  lastSyncAt = null,
  isOnline = true
}) {
  return {
    clientId,
    roomId,
    cards,
    lastEventSequence,
    lastSyncAt,
    isOnline
  };
}

function createDiff({
  type,
  cardId,
  field,
  serverValue,
  clientValue,
  eventId = null
}) {
  return {
    type,
    cardId,
    field,
    serverValue,
    clientValue,
    eventId
  };
}

function validateCard(card) {
  if (!card.id || typeof card.id !== 'string') return false;
  if (!card.title || typeof card.title !== 'string') return false;
  if (!Object.values(CARD_STATUSES).includes(card.status)) return false;
  return true;
}

function validateEvent(event) {
  if (!event.id || typeof event.id !== 'string') return false;
  if (!Object.values(EVENT_TYPES).includes(event.type)) return false;
  if (!event.roomId || typeof event.roomId !== 'string') return false;
  return true;
}

module.exports = {
  createCard,
  createEvent,
  createRoom,
  createClientState,
  createDiff,
  validateCard,
  validateEvent
};
