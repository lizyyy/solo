const { v4: uuidv4 } = require('uuid');
const { CARD_STATUSES, EVENT_TYPES, DEFAULT_ROOM } = require('../shared/constants');
const { createRoom, createEvent, createClientState } = require('../shared/types');
const { StateMachine } = require('../shared/stateMachine');
const persistence = require('./persistence');

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.roomStateMachines = new Map();
    this.loadAllRooms();
  }

  loadAllRooms() {
    const roomIds = persistence.listAllRooms();
    roomIds.forEach(roomId => {
      const room = persistence.loadRoom(roomId);
      if (room) {
        const events = persistence.loadEvents(roomId);
        const sm = new StateMachine({
          cards: room.cards,
          eventLog: events
        });
        this.rooms.set(roomId, { ...room, events });
        this.roomStateMachines.set(roomId, sm);
      }
    });
  }

  getOrCreateRoom(roomId, options = {}) {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId);
    }

    const room = createRoom({
      id: roomId,
      name: options.name || roomId,
      cards: options.cards || [],
      members: []
    });

    const events = [];
    const sm = new StateMachine();

    this.rooms.set(roomId, { ...room, events });
    this.roomStateMachines.set(roomId, sm);
    
    persistence.saveRoom(room);
    persistence.saveEvents(roomId, events);

    return this.rooms.get(roomId);
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  applyEvent(roomId, event) {
    const room = this.rooms.get(roomId);
    const sm = this.roomStateMachines.get(roomId);
    
    if (!room || !sm) {
      return { success: false, error: 'Room not found' };
    }

    const eventWithId = {
      ...event,
      id: event.id || uuidv4()
    };

    const result = sm.applyEvent(eventWithId);
    
    if (result.success && !result.isDuplicate) {
      eventWithId.sequence = result.sequence;
      eventWithId.receivedAt = Date.now();
      
      room.events.push(eventWithId);
      room.lastEventAt = eventWithId.receivedAt;
      room.cards = sm.getCardsArray();
      
      persistence.saveRoom(room);
      persistence.saveEvents(roomId, room.events);
    }

    return {
      ...result,
      event: eventWithId
    };
  }

  getEventsSince(roomId, sinceSequence = 0) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    
    return room.events.filter(e => e.sequence > sinceSequence);
  }

  getClientState(roomId, clientId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    const clientStates = persistence.loadClientStates(roomId);
    return clientStates[clientId] || null;
  }

  updateClientState(roomId, clientId, state) {
    const clientStates = persistence.loadClientStates(roomId);
    clientStates[clientId] = {
      ...clientStates[clientId],
      ...state,
      lastSyncAt: Date.now()
    };
    persistence.saveClientStates(roomId, clientStates);
    return clientStates[clientId];
  }

  addMember(roomId, clientId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    if (!room.members.includes(clientId)) {
      room.members.push(clientId);
      persistence.saveRoom(room);
    }
    
    const clientState = createClientState({
      clientId,
      roomId,
      lastEventSequence: room.events.length > 0 
        ? Math.max(...room.events.map(e => e.sequence || 0))
        : 0
    });
    
    return this.updateClientState(roomId, clientId, clientState);
  }

  removeMember(roomId, clientId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const index = room.members.indexOf(clientId);
    if (index > -1) {
      room.members.splice(index, 1);
      persistence.saveRoom(room);
    }
  }

  getStateMachine(roomId) {
    return this.roomStateMachines.get(roomId);
  }

  computeClientDiff(roomId, clientId) {
    const sm = this.roomStateMachines.get(roomId);
    if (!sm) return null;
    
    const clientStates = persistence.loadClientStates(roomId);
    const clientState = clientStates[clientId];
    
    if (!clientState) {
      return {
        clientState: null,
        serverState: {
          cards: sm.getCardsMap()
        },
        diffs: sm.computeDiff({ cards: {} })
      };
    }
    
    return {
      clientState: {
        cards: clientState.cards,
        lastEventSequence: clientState.lastEventSequence
      },
      serverState: {
        cards: sm.getCardsMap()
      },
      diffs: sm.computeDiff({ cards: clientState.cards })
    };
  }

  resetRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    
    const newRoom = createRoom({
      id: room.id,
      name: room.name,
      cards: [],
      members: room.members
    });
    
    const sm = new StateMachine();
    
    this.rooms.set(roomId, { ...newRoom, events: [] });
    this.roomStateMachines.set(roomId, sm);
    
    persistence.saveRoom(newRoom);
    persistence.saveEvents(roomId, []);
    
    return true;
  }

  deleteRoom(roomId) {
    this.rooms.delete(roomId);
    this.roomStateMachines.delete(roomId);
    persistence.deleteRoom(roomId);
    return true;
  }
}

const roomManager = new RoomManager();

module.exports = roomManager;
