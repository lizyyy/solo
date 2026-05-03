const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json({ limit: '10mb' }));

const rooms = new Map();
const clients = new Map();

const generateClientId = () => `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateRoomCode = () => Math.random().toString(36).substr(2, 6).toUpperCase();

wss.on('connection', (ws) => {
  const clientId = generateClientId();
  clients.set(clientId, {
    ws,
    clientId,
    roomCode: null,
    joinedAt: Date.now()
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(clientId, message, ws);
    } catch (e) {
      console.error('Message parse error:', e);
    }
  });

  ws.on('close', () => {
    handleClientDisconnect(clientId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    handleClientDisconnect(clientId);
  });

  ws.send(JSON.stringify({
    type: 'connected',
    clientId
  }));
});

function handleClientDisconnect(clientId) {
  const client = clients.get(clientId);
  if (!client) return;

  if (client.roomCode) {
    const room = rooms.get(client.roomCode);
    if (room) {
      room.clients = room.clients.filter(c => c !== clientId);
      if (room.clients.length === 0) {
        rooms.delete(client.roomCode);
      } else {
        broadcastToRoom(client.roomCode, {
          type: 'peer-left',
          peerId: clientId
        }, clientId);
      }
    }
  }

  clients.delete(clientId);
}

function handleMessage(clientId, message, ws) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'create-room':
      handleCreateRoom(clientId, ws);
      break;
    case 'join-room':
      handleJoinRoom(clientId, message.roomCode, ws);
      break;
    case 'leave-room':
      handleLeaveRoom(clientId);
      break;
    case 'offer':
    case 'answer':
    case 'candidate':
      handleSignalingMessage(clientId, message);
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: message.timestamp }));
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
}

function handleCreateRoom(clientId, ws) {
  const roomCode = generateRoomCode();
  rooms.set(roomCode, {
    roomCode,
    clients: [clientId],
    createdAt: Date.now()
  });

  const client = clients.get(clientId);
  if (client) {
    client.roomCode = roomCode;
  }

  ws.send(JSON.stringify({
    type: 'room-created',
    roomCode
  }));
}

function handleJoinRoom(clientId, roomCode, ws) {
  const room = rooms.get(roomCode);
  if (!room) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Room not found'
    }));
    return;
  }

  if (room.clients.length >= 2) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Room is full'
    }));
    return;
  }

  room.clients.push(clientId);
  
  const client = clients.get(clientId);
  if (client) {
    client.roomCode = roomCode;
  }

  ws.send(JSON.stringify({
    type: 'room-joined',
    roomCode,
    peers: room.clients.filter(c => c !== clientId)
  }));

  broadcastToRoom(roomCode, {
    type: 'peer-joined',
    peerId: clientId
  }, clientId);
}

function handleLeaveRoom(clientId) {
  const client = clients.get(clientId);
  if (!client || !client.roomCode) return;

  const room = rooms.get(client.roomCode);
  if (room) {
    room.clients = room.clients.filter(c => c !== clientId);
    if (room.clients.length === 0) {
      rooms.delete(client.roomCode);
    } else {
      broadcastToRoom(client.roomCode, {
        type: 'peer-left',
        peerId: clientId
      }, clientId);
    }
  }

  client.roomCode = null;
}

function handleSignalingMessage(clientId, message) {
  const client = clients.get(clientId);
  if (!client || !client.roomCode) return;

  broadcastToRoom(client.roomCode, {
    ...message,
    from: clientId
  }, clientId);
}

function broadcastToRoom(roomCode, message, excludeClientId = null) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const messageStr = JSON.stringify(message);
  
  room.clients.forEach(clientId => {
    if (clientId === excludeClientId) return;
    
    const client = clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(messageStr);
      } catch (e) {
        console.error('Broadcast error:', e);
      }
    }
  });
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebRTC 弱网协作预演台已启动`);
  console.log(`- 服务地址: http://localhost:${PORT}`);
  console.log(`- WebSocket: ws://localhost:${PORT}`);
  console.log(`- 双端测试: 打开两个浏览器标签页访问 http://localhost:${PORT}`);
});
