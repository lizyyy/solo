const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { EVENT_TYPES, DEFAULT_ROOM, CARD_STATUSES } = require('../shared/constants');
const { validateEvent } = require('../shared/types');
const roomManager = require('./roomManager');
const replayManager = require('./replayManager');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));

const PORT = process.env.PORT || 3000;

const clients = new Map();
const clientRooms = new Map();

function broadcastToRoom(roomId, message, excludeClientId = null) {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  const messageStr = JSON.stringify(message);
  
  room.members.forEach(clientId => {
    if (clientId === excludeClientId) return;
    
    const client = clients.get(clientId);
    if (client && client.ws && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

function sendToClient(clientId, message) {
  const client = clients.get(clientId);
  if (client && client.ws && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  console.log(`Client connected: ${clientId}`);

  clients.set(clientId, {
    id: clientId,
    ws,
    currentRoomId: null,
    connectedAt: Date.now()
  });

  ws.send(JSON.stringify({
    type: 'connected',
    clientId
  }));

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleClientMessage(clientId, message, ws);
    } catch (error) {
      console.error('Message parsing error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    const client = clients.get(clientId);
    if (client && client.currentRoomId) {
      roomManager.removeMember(client.currentRoomId, clientId);
      clientRooms.delete(clientId);
      
      broadcastToRoom(client.currentRoomId, {
        type: 'member_left',
        clientId,
        roomId: client.currentRoomId
      });
    }
    clients.delete(clientId);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });
});

function handleClientMessage(clientId, message, ws) {
  const { type, roomId, payload, clientId: msgClientId } = message;
  const effectiveClientId = msgClientId || clientId;

  switch (type) {
    case EVENT_TYPES.JOIN_ROOM:
      handleJoinRoom(effectiveClientId, message.roomId, ws);
      break;

    case EVENT_TYPES.LEAVE_ROOM:
      handleLeaveRoom(effectiveClientId, message.roomId);
      break;

    case EVENT_TYPES.CARD_CREATED:
    case EVENT_TYPES.CARD_MOVED:
    case EVENT_TYPES.CARD_UPDATED:
    case EVENT_TYPES.CARD_DELETED:
      handleEvent(effectiveClientId, message);
      break;

    case EVENT_TYPES.SYNC_REQUEST:
      handleSyncRequest(effectiveClientId, message);
      break;

    case EVENT_TYPES.CLIENT_STATE:
      handleClientStateUpdate(effectiveClientId, message);
      break;

    case 'get_rooms':
      handleGetRooms(effectiveClientId);
      break;

    case 'get_scripts':
      handleGetScripts(effectiveClientId);
      break;

    case 'start_replay':
      handleStartReplay(effectiveClientId, message);
      break;

    case 'stop_replay':
      handleStopReplay(effectiveClientId, message);
      break;

    case 'get_replay_status':
      handleGetReplayStatus(effectiveClientId, message);
      break;

    case 'reset_room':
      handleResetRoom(effectiveClientId, message);
      break;

    case 'get_diff':
      handleGetDiff(effectiveClientId, message);
      break;

    default:
      sendToClient(effectiveClientId, {
        type: 'error',
        message: `Unknown message type: ${type}`
      });
  }
}

function handleJoinRoom(clientId, roomId, ws) {
  const room = roomManager.getOrCreateRoom(roomId, {
    name: `Room ${roomId}`
  });

  const client = clients.get(clientId);
  if (client) {
    client.currentRoomId = roomId;
    clientRooms.set(clientId, roomId);
  }

  const clientState = roomManager.addMember(roomId, clientId);
  const stateMachine = roomManager.getStateMachine(roomId);

  sendToClient(clientId, {
    type: EVENT_TYPES.ROOM_JOINED,
    roomId,
    room: {
      id: room.id,
      name: room.name,
      members: room.members
    },
    cards: stateMachine ? stateMachine.getCardsArray() : [],
    events: room.events,
    clientState: {
      lastEventSequence: clientState.lastEventSequence
    }
  });

  broadcastToRoom(roomId, {
    type: 'member_joined',
    clientId,
    roomId,
    members: room.members
  }, clientId);
}

function handleLeaveRoom(clientId, roomId) {
  roomManager.removeMember(roomId, clientId);
  
  const client = clients.get(clientId);
  if (client) {
    client.currentRoomId = null;
  }
  clientRooms.delete(clientId);

  sendToClient(clientId, {
    type: 'room_left',
    roomId
  });

  broadcastToRoom(roomId, {
    type: 'member_left',
    clientId,
    roomId
  });
}

function handleEvent(clientId, message) {
  const { roomId, type, payload, id: eventId } = message;
  const room = roomManager.getRoom(roomId);
  
  if (!room) {
    sendToClient(clientId, {
      type: 'error',
      message: 'Room not found'
    });
    return;
  }

  const event = {
    id: eventId || uuidv4(),
    type,
    roomId,
    payload,
    clientId,
    timestamp: Date.now()
  };

  const result = roomManager.applyEvent(roomId, event);

  if (result.success) {
    const broadcastEvent = {
      ...event,
      sequence: result.event.sequence,
      receivedAt: result.event.receivedAt,
      isDuplicate: result.isDuplicate
    };

    broadcastToRoom(roomId, {
      type: 'event_applied',
      event: broadcastEvent,
      result: {
        success: true,
        isDuplicate: result.isDuplicate,
        sequence: result.event.sequence
      }
    });

    sendToClient(clientId, {
      type: 'event_ack',
      eventId: event.id,
      success: true,
      isDuplicate: result.isDuplicate,
      sequence: result.event.sequence
    });
  } else {
    sendToClient(clientId, {
      type: 'event_ack',
      eventId: event.id,
      success: false,
      error: result.error
    });
  }
}

function handleSyncRequest(clientId, message) {
  const { roomId, sinceSequence = 0 } = message;
  const room = roomManager.getRoom(roomId);
  
  if (!room) {
    sendToClient(clientId, {
      type: 'error',
      message: 'Room not found'
    });
    return;
  }

  const events = roomManager.getEventsSince(roomId, sinceSequence);
  const stateMachine = roomManager.getStateMachine(roomId);

  roomManager.updateClientState(roomId, clientId, {
    lastEventSequence: stateMachine.getCurrentSequence(),
    cards: stateMachine.getCardsMap()
  });

  sendToClient(clientId, {
    type: EVENT_TYPES.SYNC_RESPONSE,
    roomId,
    currentSequence: stateMachine.getCurrentSequence(),
    missedEvents: events,
    cards: stateMachine.getCardsArray()
  });
}

function handleClientStateUpdate(clientId, message) {
  const { roomId, state } = message;
  
  if (state && state.cards !== undefined) {
    roomManager.updateClientState(roomId, clientId, {
      cards: state.cards,
      lastEventSequence: state.lastEventSequence
    });
  }
}

function handleGetRooms(clientId) {
  const rooms = roomManager.getAllRooms().map(room => ({
    id: room.id,
    name: room.name,
    members: room.members,
    eventCount: room.events ? room.events.length : 0,
    cardCount: room.cards ? room.cards.length : 0
  }));

  sendToClient(clientId, {
    type: 'rooms_list',
    rooms
  });
}

function handleGetScripts(clientId) {
  const scripts = replayManager.getBuiltinScripts();
  const scriptList = Object.entries(scripts).map(([id, script]) => ({
    id,
    name: script.name,
    description: script.description,
    eventCount: script.events.length
  }));

  sendToClient(clientId, {
    type: 'scripts_list',
    scripts: scriptList
  });
}

async function handleStartReplay(clientId, message) {
  const { roomId, scriptId } = message;
  const result = await replayManager.startReplay(roomId, scriptId);

  if (result.success) {
    const stateMachine = roomManager.getStateMachine(roomId);
    broadcastToRoom(roomId, {
      type: 'replay_started',
      replayId: result.replayId,
      script: result.script,
      eventCount: result.eventCount
    });

    broadcastToRoom(roomId, {
      type: 'state_update',
      cards: stateMachine.getCardsArray()
    });
  }

  sendToClient(clientId, {
    type: 'replay_result',
    success: result.success,
    replayId: result.replayId,
    error: result.error
  });
}

function handleStopReplay(clientId, message) {
  const { replayId } = message;
  const result = replayManager.stopReplay(replayId);

  sendToClient(clientId, {
    type: 'replay_stopped',
    success: result.success,
    error: result.error
  });
}

function handleGetReplayStatus(clientId, message) {
  const { replayId } = message;
  const status = replayManager.getReplayStatus(replayId);

  if (status) {
    sendToClient(clientId, {
      type: 'replay_status',
      status
    });
  } else {
    sendToClient(clientId, {
      type: 'error',
      message: 'Replay not found'
    });
  }
}

function handleResetRoom(clientId, message) {
  const { roomId } = message;
  const success = roomManager.resetRoom(roomId);

  if (success) {
    broadcastToRoom(roomId, {
      type: 'room_reset',
      roomId
    });

    broadcastToRoom(roomId, {
      type: 'state_update',
      cards: []
    });
  }

  sendToClient(clientId, {
    type: 'room_reset_ack',
    success,
    roomId
  });
}

function handleGetDiff(clientId, message) {
  const { roomId, targetClientId } = message;
  const diff = roomManager.computeClientDiff(roomId, targetClientId || clientId);

  if (diff) {
    sendToClient(clientId, {
      type: 'diff_result',
      diff
    });
  } else {
    sendToClient(clientId, {
      type: 'error',
      message: 'Room or client not found'
    });
  }
}

app.get('/api/rooms', (req, res) => {
  const rooms = roomManager.getAllRooms().map(room => ({
    id: room.id,
    name: room.name,
    members: room.members,
    eventCount: room.events ? room.events.length : 0
  }));
  res.json(rooms);
});

app.get('/api/rooms/:roomId', (req, res) => {
  const room = roomManager.getRoom(req.params.roomId);
  if (room) {
    res.json({
      id: room.id,
      name: room.name,
      members: room.members,
      cards: room.cards,
      eventCount: room.events.length
    });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

app.get('/api/scripts', (req, res) => {
  const scripts = replayManager.getBuiltinScripts();
  res.json(Object.entries(scripts).map(([id, script]) => ({
    id,
    name: script.name,
    description: script.description,
    eventCount: script.events.length
  })));
});

function createDemoRoom() {
  const demoRoomId = DEFAULT_ROOM;
  const existingRoom = roomManager.getRoom(demoRoomId);
  
  if (!existingRoom) {
    const demoRoom = roomManager.getOrCreateRoom(demoRoomId, {
      name: '演示房间 1',
      cards: []
    });

    const demoEvents = [
      {
        id: 'demo-evt-001',
        type: EVENT_TYPES.CARD_CREATED,
        roomId: demoRoomId,
        payload: {
          cardId: 'demo-card-001',
          title: '设计数据库架构',
          status: CARD_STATUSES.TODO
        },
        clientId: 'demo-client',
        timestamp: Date.now() - 3600000
      },
      {
        id: 'demo-evt-002',
        type: EVENT_TYPES.CARD_CREATED,
        roomId: demoRoomId,
        payload: {
          cardId: 'demo-card-002',
          title: '实现用户认证',
          status: CARD_STATUSES.IN_PROGRESS,
          assignee: 'Alice'
        },
        clientId: 'demo-client',
        timestamp: Date.now() - 1800000
      },
      {
        id: 'demo-evt-003',
        type: EVENT_TYPES.CARD_CREATED,
        roomId: demoRoomId,
        payload: {
          cardId: 'demo-card-003',
          title: '编写API文档',
          status: CARD_STATUSES.DONE,
          assignee: 'Bob'
        },
        clientId: 'demo-client',
        timestamp: Date.now() - 60000
      }
    ];

    demoEvents.forEach(event => {
      roomManager.applyEvent(demoRoomId, event);
    });

    console.log(`Created demo room: ${demoRoomId}`);
  }
}

createDemoRoom();

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server on ws://localhost:${PORT}`);
  console.log(`Demo room: ${DEFAULT_ROOM}`);
});
