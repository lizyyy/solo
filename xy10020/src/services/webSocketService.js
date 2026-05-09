const WebSocket = require('ws');
const logger = require('../utils/logger');
const LiveRoom = require('../models/LiveRoom');
const Message = require('../models/Message');
const UserConnection = require('../models/UserConnection');
const OperationLog = require('../models/OperationLog');
const { authenticateWebSocket } = require('../middleware/auth');

class WebSocketService {
  constructor(server) {
    this.server = server;
    this.wss = new WebSocket.Server({
      server,
      verifyClient: authenticateWebSocket
    });

    this.rooms = new Map();
    this.connectionMap = new Map();

    this.setupEventListeners();
    this.startHealthCheck();
  }

  setupEventListeners() {
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket服务器错误:', error);
    });
  }

  handleConnection(ws, req) {
    const user = req.user;
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const liveRoomId = urlParams.get('liveRoomId');

    if (!liveRoomId) {
      ws.close(4000, '缺少直播间ID');
      return;
    }

    const liveRoom = LiveRoom.findById(liveRoomId);
    if (!liveRoom) {
      ws.close(4004, '直播间不存在');
      return;
    }

    const connectionId = UserConnection.create({
      userId: user.id,
      liveRoomId,
      connectionType: 'websocket'
    });

    ws.connectionId = connectionId;
    ws.userId = user.id;
    ws.liveRoomId = liveRoomId;
    ws.username = user.username;
    ws.isAlive = true;

    if (!this.rooms.has(liveRoomId)) {
      this.rooms.set(liveRoomId, new Set());
    }
    this.rooms.get(liveRoomId).add(ws);

    this.connectionMap.set(connectionId, ws);

    LiveRoom.incrementViewerCount(liveRoomId, 1);

    logger.info(`用户连接直播间: ${user.username} -> ${liveRoomId}`);

    this.sendRoomState(ws, liveRoomId);

    this.broadcastToRoom(liveRoomId, {
      type: 'user_joined',
      data: {
        userId: user.id,
        username: user.username,
        timestamp: Date.now()
      }
    });

    ws.on('message', (data) => {
      this.handleMessage(ws, data);
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnection(ws, code, reason);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket连接错误: ${connectionId}`, error);
      this.handleDisconnection(ws, 1011, '连接错误');
    });
  }

  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'ping':
          this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
          break;

        case 'chat_message':
          this.handleChatMessage(ws, message.data);
          break;

        case 'request_history':
          this.handleHistoryRequest(ws, message.data);
          break;

        case 'heartbeat':
          ws.isAlive = true;
          break;

        default:
          logger.warn(`未知消息类型: ${message.type}`);
      }
    } catch (err) {
      logger.error('消息处理错误:', err);
      this.sendToClient(ws, {
        type: 'error',
        data: { message: '消息格式错误' }
      });
    }
  }

  handleChatMessage(ws, data) {
    if (!data || !data.content) {
      return;
    }

    const liveRoomId = ws.liveRoomId;
    const senderId = ws.userId;

    const { id, sequenceNumber, createdAt } = Message.create({
      liveRoomId,
      senderId,
      content: data.content,
      messageType: data.messageType || 'chat'
    });

    const messageData = {
      id,
      liveRoomId,
      senderId,
      senderName: ws.username,
      content: data.content,
      messageType: data.messageType || 'chat',
      sequenceNumber,
      timestamp: createdAt
    };

    this.broadcastToRoom(liveRoomId, {
      type: 'chat_message',
      data: messageData
    });

    OperationLog.create({
      operationType: 'SEND_MESSAGE',
      entityType: 'message',
      entityId: id,
      userId: senderId
    });
  }

  handleHistoryRequest(ws, data) {
    const liveRoomId = ws.liveRoomId;
    const sinceSequence = data?.sinceSequence || 0;
    const limit = Math.min(data?.limit || 100, 500);

    const messages = Message.findByLiveRoom(liveRoomId, {
      sinceSequence,
      limit
    });

    this.sendToClient(ws, {
      type: 'message_history',
      data: {
        messages,
        maxSequence: Message.getMaxSequence(liveRoomId)
      }
    });
  }

  handleDisconnection(ws, code, reason) {
    const liveRoomId = ws.liveRoomId;
    const userId = ws.userId;
    const connectionId = ws.connectionId;
    const username = ws.username;

    if (this.rooms.has(liveRoomId)) {
      this.rooms.get(liveRoomId).delete(ws);

      if (this.rooms.get(liveRoomId).size === 0) {
        this.rooms.delete(liveRoomId);
      }
    }

    if (connectionId) {
      UserConnection.markDisconnected(connectionId);
      this.connectionMap.delete(connectionId);
    }

    if (liveRoomId) {
      LiveRoom.incrementViewerCount(liveRoomId, -1);
    }

    logger.info(`用户离开直播间: ${username} -> ${liveRoomId}, 代码: ${code}, 原因: ${reason}`);

    this.broadcastToRoom(liveRoomId, {
      type: 'user_left',
      data: {
        userId,
        username,
        timestamp: Date.now()
      }
    });
  }

  sendRoomState(ws, liveRoomId) {
    const liveRoom = LiveRoom.findById(liveRoomId);
    const activeUsers = UserConnection.getActiveUsersByLiveRoom(liveRoomId);
    const maxSequence = Message.getMaxSequence(liveRoomId);

    this.sendToClient(ws, {
      type: 'room_state',
      data: {
        room: liveRoom,
        activeUsers,
        maxSequence,
        timestamp: Date.now()
      }
    });
  }

  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcastToRoom(liveRoomId, message) {
    const room = this.rooms.get(liveRoomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);

    for (const ws of room) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }
  }

  broadcastToRoomExcept(liveRoomId, message, excludeWs) {
    const room = this.rooms.get(liveRoomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);

    for (const ws of room) {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }
  }

  sendSystemMessage(liveRoomId, content) {
    const messageData = {
      id: Date.now().toString(),
      liveRoomId,
      senderId: 'system',
      senderName: '系统消息',
      content,
      messageType: 'system',
      timestamp: Date.now()
    };

    this.broadcastToRoom(liveRoomId, {
      type: 'system_message',
      data: messageData
    });
  }

  getRoomUserCount(liveRoomId) {
    const room = this.rooms.get(liveRoomId);
    return room ? room.size : 0;
  }

  startHealthCheck() {
    setInterval(() => {
      for (const [liveRoomId, room] of this.rooms) {
        for (const ws of room) {
          if (!ws.isAlive) {
            logger.warn(`连接超时，关闭连接: ${ws.connectionId}`);
            ws.terminate();
            continue;
          }

          ws.isAlive = false;
          ws.ping();
        }
      }
    }, 30000);
  }

  getStatistics() {
    const stats = {
      totalConnections: this.connectionMap.size,
      rooms: []
    };

    for (const [liveRoomId, room] of this.rooms) {
      stats.rooms.push({
        liveRoomId,
        connectionCount: room.size
      });
    }

    return stats;
  }
}

module.exports = WebSocketService;
