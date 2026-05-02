const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const rooms = new Map();
const userRooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function broadcastToRoom(roomId, message, excludeWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  const msgStr = JSON.stringify(message);
  room.users.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(msgStr);
    }
  });
}

wss.on('connection', (ws) => {
  const userId = uuidv4();
  ws.userId = userId;
  
  console.log(`[${new Date().toISOString()}] User connected: ${userId}`);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(ws, message);
    } catch (e) {
      console.error('Message parse error:', e);
    }
  });

  ws.on('close', () => {
    console.log(`[${new Date().toISOString()}] User disconnected: ${userId}`);
    handleDisconnect(ws);
  });
});

function handleMessage(ws, message) {
  const { type, payload } = message;
  const userId = ws.userId;

  switch (type) {
    case 'CREATE_ROOM':
      handleCreateRoom(ws, payload);
      break;
    case 'JOIN_ROOM':
      handleJoinRoom(ws, payload);
      break;
    case 'LEAVE_ROOM':
      handleLeaveRoom(ws);
      break;
    case 'SIGNAL':
      handleSignal(ws, payload);
      break;
    default:
      console.log('Unknown message type:', type);
  }
}

function handleCreateRoom(ws, payload) {
  let roomCode;
  do {
    roomCode = generateRoomCode();
  } while (rooms.has(roomCode));

  const room = {
    id: roomCode,
    creatorId: ws.userId,
    users: new Set([ws]),
    createdAt: Date.now()
  };

  rooms.set(roomCode, room);
  userRooms.set(ws, roomCode);

  console.log(`[${new Date().toISOString()}] Room created: ${roomCode} by ${ws.userId}`);

  ws.send(JSON.stringify({
    type: 'ROOM_CREATED',
    payload: {
      roomCode,
      isCreator: true
    }
  }));
}

function handleJoinRoom(ws, payload) {
  const { roomCode } = payload;
  const room = rooms.get(roomCode);

  if (!room) {
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: '房间不存在' }
    }));
    return;
  }

  if (room.users.size >= 2) {
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: '房间已满' }
    }));
    return;
  }

  room.users.add(ws);
  userRooms.set(ws, roomCode);

  console.log(`[${new Date().toISOString()}] User ${ws.userId} joined room ${roomCode}`);

  ws.send(JSON.stringify({
    type: 'ROOM_JOINED',
    payload: {
      roomCode,
      isCreator: room.creatorId === ws.userId,
      peerConnected: room.users.size > 1
    }
  }));

  broadcastToRoom(roomCode, {
    type: 'USER_JOINED',
    payload: { userId: ws.userId }
  }, ws);
}

function handleLeaveRoom(ws) {
  const roomCode = userRooms.get(ws);
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (room) {
    room.users.delete(ws);
    userRooms.delete(ws);

    console.log(`[${new Date().toISOString()}] User ${ws.userId} left room ${roomCode}`);

    if (room.users.size === 0) {
      rooms.delete(roomCode);
      console.log(`[${new Date().toISOString()}] Room ${roomCode} destroyed (empty)`);
    } else {
      broadcastToRoom(roomCode, {
        type: 'USER_LEFT',
        payload: { userId: ws.userId }
      });
    }
  }
}

function handleDisconnect(ws) {
  handleLeaveRoom(ws);
}

function handleSignal(ws, payload) {
  const { roomCode, signal } = payload;
  const room = rooms.get(roomCode);

  if (!room) {
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: '房间不存在' }
    }));
    return;
  }

  broadcastToRoom(roomCode, {
    type: 'SIGNAL',
    payload: {
      userId: ws.userId,
      signal
    }
  }, ws);
}

server.listen(PORT, () => {
  const pad = PORT === 3000 ? ' ' : '';
  console.log(`╔══════════════════════════════════════════════╗`);
  console.log(`║   WebRTC 文件互传演练台已启动                  ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║   访问地址: http://localhost:${PORT}${pad}             ║`);
  console.log(`║   测试方式: 打开两个浏览器窗口访问此地址        ║`);
  console.log(`╚══════════════════════════════════════════════╝`);
});
