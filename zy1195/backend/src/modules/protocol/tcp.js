const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

const TCP_STATES = {
  CLOSED: 'CLOSED',
  LISTEN: 'LISTEN',
  SYN_SENT: 'SYN_SENT',
  SYN_RCVD: 'SYN_RCVD',
  ESTABLISHED: 'ESTABLISHED',
  FIN_WAIT_1: 'FIN_WAIT_1',
  FIN_WAIT_2: 'FIN_WAIT_2',
  CLOSE_WAIT: 'CLOSE_WAIT',
  CLOSING: 'CLOSING',
  LAST_ACK: 'LAST_ACK',
  TIME_WAIT: 'TIME_WAIT'
};

class TCPSimulator extends EventEmitter {
  constructor(config, experimentId) {
    super();
    this.config = config;
    this.experimentId = experimentId;
    this.connections = new Map();
    this.serverState = TCP_STATES.LISTEN;
    this.seqNum = Math.floor(Math.random() * 1000000);
    this.ackNum = 0;
  }

  createConnection(clientId) {
    const connectionId = uuidv4();
    const connection = {
      id: connectionId,
      clientId,
      state: TCP_STATES.CLOSED,
      seqNum: Math.floor(Math.random() * 1000000),
      ackNum: 0,
      serverSeq: this.seqNum++,
      serverAck: 0,
      rtt: 100,
      lastActivity: Date.now(),
      retries: 0,
      sendBuffer: [],
      recvBuffer: [],
      retransmissionTimer: null,
      heartbeatTimer: null
    };
    this.connections.set(connectionId, connection);
    return connection;
  }

  async simulateThreeWayHandshake(clientId) {
    const connection = this.createConnection(clientId);
    
    this.emit('packet', {
      experimentId: this.experimentId,
      connectionId: connection.id,
      timestamp: new Date().toISOString(),
      direction: 'client->server',
      type: 'SYN',
      payload: `SYN seq=${connection.seqNum}`,
      size: 40
    });
    
    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'TCP_SYN_SENT',
      source: `client-${clientId}`,
      target: 'server',
      payload: `SYN seq=${connection.seqNum}`,
      details: '客户端发送 SYN，请求建立连接'
    });

    connection.state = TCP_STATES.SYN_SENT;

    await this.delay(connection.rtt);

    connection.serverAck = connection.seqNum + 1;
    this.emit('packet', {
      experimentId: this.experimentId,
      connectionId: connection.id,
      timestamp: new Date().toISOString(),
      direction: 'server->client',
      type: 'SYN+ACK',
      payload: `SYN seq=${connection.serverSeq}, ACK ack=${connection.serverAck}`,
      size: 44
    });
    
    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'TCP_SYN_ACK',
      source: 'server',
      target: `client-${clientId}`,
      payload: `SYN+ACK seq=${connection.serverSeq}, ack=${connection.serverAck}`,
      details: '服务器收到 SYN，发送 SYN+ACK 确认'
    });

    connection.state = TCP_STATES.SYN_RCVD;

    await this.delay(connection.rtt);

    connection.ackNum = connection.serverSeq + 1;
    this.emit('packet', {
      experimentId: this.experimentId,
      connectionId: connection.id,
      timestamp: new Date().toISOString(),
      direction: 'client->server',
      type: 'ACK',
      payload: `ACK ack=${connection.ackNum}`,
      size: 32
    });
    
    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'TCP_ACK',
      source: `client-${clientId}`,
      target: 'server',
      payload: `ACK ack=${connection.ackNum}`,
      details: '客户端收到 SYN+ACK，发送 ACK，连接建立完成'
    });

    connection.state = TCP_STATES.ESTABLISHED;
    connection.lastActivity = Date.now();

    this.emit('connection', {
      experimentId: this.experimentId,
      connectionId: connection.id,
      clientId,
      state: TCP_STATES.ESTABLISHED,
      timestamp: new Date().toISOString()
    });

    return connection;
  }

  async sendData(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.state !== TCP_STATES.ESTABLISHED) {
      throw new Error('连接未建立');
    }

    const segments = this.splitIntoSegments(data, connection);
    
    for (const segment of segments) {
      connection.seqNum += segment.length;
      
      this.emit('packet', {
        experimentId: this.experimentId,
        connectionId: connection.id,
        timestamp: new Date().toISOString(),
        direction: 'client->server',
        type: 'DATA',
        payload: `seq=${connection.seqNum - segment.length} len=${segment.length} data=${JSON.stringify(segment)}`,
        size: 32 + segment.length
      });

      await this.delay(this.config.sendInterval || 100);

      this.emit('packet', {
        experimentId: this.experimentId,
        connectionId: connection.id,
        timestamp: new Date().toISOString(),
        direction: 'server->client',
        type: 'ACK',
        payload: `ack=${connection.seqNum}`,
        size: 32
      });

      connection.lastActivity = Date.now();
    }

    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'DATA_SENT',
      source: `client-${connection.clientId}`,
      target: 'server',
      payload: data,
      details: `发送数据 ${segments.length} 个报文段，共 ${data.length} 字节`
    });

    return segments;
  }

  splitIntoSegments(data, connection) {
    const mss = 1460;
    const segments = [];
    
    if (this.config.enableNagle) {
      segments.push(data);
    } else {
      for (let i = 0; i < data.length; i += mss) {
        segments.push(data.slice(i, i + mss));
      }
    }
    
    return segments;
  }

  simulateStickyPacket(connectionId, messages) {
    const connection = this.connections.get(connectionId);
    if (!connection) return [];

    const stickyData = messages.join(this.config.messageDelimiter || '');
    
    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'STICKY_PACKET',
      source: `client-${connection.clientId}`,
      target: 'server',
      payload: stickyData,
      details: `模拟粘包：${messages.length} 条消息合并发送，使用分隔符 "${this.config.messageDelimiter || '(无)'}"`
    });

    return [stickyData];
  }

  simulateUnpacking(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) return [];

    const delimiter = this.config.messageDelimiter;
    const messages = delimiter ? data.split(delimiter).filter(m => m) : [data];

    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'PACKET_UNPACKING',
      source: 'server',
      target: `client-${connection.clientId}`,
      payload: JSON.stringify(messages),
      details: `模拟拆包：从 ${data.length} 字节中解析出 ${messages.length} 条消息`
    });

    return messages;
  }

  startHeartbeat(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const heartbeatInterval = this.config.heartbeatInterval || 5000;
    
    connection.heartbeatTimer = setInterval(() => {
      if (connection.state !== TCP_STATES.ESTABLISHED) {
        clearInterval(connection.heartbeatTimer);
        return;
      }

      this.emit('packet', {
        experimentId: this.experimentId,
        connectionId: connection.id,
        timestamp: new Date().toISOString(),
        direction: 'client->server',
        type: 'HEARTBEAT',
        payload: 'PING',
        size: 32
      });

      this.emit('event', {
        experimentId: this.experimentId,
        timestamp: new Date().toISOString(),
        type: 'HEARTBEAT_SEND',
        source: `client-${connection.clientId}`,
        target: 'server',
        payload: 'PING',
        details: '发送心跳包'
      });

      setTimeout(() => {
        this.emit('packet', {
          experimentId: this.experimentId,
          connectionId: connection.id,
          timestamp: new Date().toISOString(),
          direction: 'server->client',
          type: 'HEARTBEAT_ACK',
          payload: 'PONG',
          size: 32
        });

        connection.lastActivity = Date.now();
      }, connection.rtt);
    }, heartbeatInterval);
  }

  stopHeartbeat(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection && connection.heartbeatTimer) {
      clearInterval(connection.heartbeatTimer);
      connection.heartbeatTimer = null;
    }
  }

  checkTimeout(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    const timeout = this.config.timeoutThreshold || 30000;
    const now = Date.now();
    const timeSinceActivity = now - connection.lastActivity;

    if (timeSinceActivity > timeout) {
      this.emit('event', {
        experimentId: this.experimentId,
        timestamp: new Date().toISOString(),
        type: 'CONNECTION_TIMEOUT',
        source: 'server',
        target: `client-${connection.clientId}`,
        payload: `timeout=${timeSinceActivity}ms`,
        details: `连接超时：超过 ${timeout}ms 无活动`
      });

      connection.state = TCP_STATES.CLOSED;
      this.stopHeartbeat(connectionId);
      return true;
    }

    return false;
  }

  async simulateReconnect(clientId, maxRetries = 5) {
    const baseDelay = 1000;
    let retries = 0;
    let success = false;
    let connection = null;

    while (retries < maxRetries && !success) {
      const delay = baseDelay * Math.pow(2, retries);
      
      this.emit('event', {
        experimentId: this.experimentId,
        timestamp: new Date().toISOString(),
        type: 'RECONNECT_ATTEMPT',
        source: `client-${clientId}`,
        target: 'server',
        payload: `retry=${retries + 1}, delay=${delay}ms`,
        details: `第 ${retries + 1} 次重连尝试，等待 ${delay}ms（指数退避）`
      });

      await this.delay(delay);

      try {
        connection = await this.simulateThreeWayHandshake(clientId);
        success = true;
        
        this.emit('event', {
          experimentId: this.experimentId,
          timestamp: new Date().toISOString(),
          type: 'RECONNECT_SUCCESS',
          source: `client-${clientId}`,
          target: 'server',
          payload: `retries=${retries + 1}`,
          details: `重连成功，共尝试 ${retries + 1} 次`
        });
      } catch (err) {
        retries++;
        
        this.emit('event', {
          experimentId: this.experimentId,
          timestamp: new Date().toISOString(),
          type: 'RECONNECT_FAILED',
          source: `client-${clientId}`,
          target: 'server',
          payload: `retry=${retries}, error=${err.message}`,
          details: `第 ${retries} 次重连失败`
        });
      }
    }

    if (!success) {
      this.emit('event', {
        experimentId: this.experimentId,
        timestamp: new Date().toISOString(),
        type: 'RECONNECT_EXHAUSTED',
        source: `client-${clientId}`,
        target: 'server',
        payload: `max_retries=${maxRetries}`,
        details: `已达到最大重连次数 ${maxRetries}，放弃重连`
      });
    }

    return { success, connection, retries };
  }

  async simulateFourWayHandshake(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.state = TCP_STATES.FIN_WAIT_1;
    
    this.emit('packet', {
      experimentId: this.experimentId,
      connectionId: connection.id,
      timestamp: new Date().toISOString(),
      direction: 'client->server',
      type: 'FIN',
      payload: `FIN seq=${connection.seqNum}`,
      size: 32
    });

    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'TCP_FIN_SENT',
      source: `client-${connection.clientId}`,
      target: 'server',
      payload: `FIN seq=${connection.seqNum}`,
      details: '客户端发送 FIN，请求关闭连接'
    });

    await this.delay(connection.rtt);

    this.emit('packet', {
      experimentId: this.experimentId,
      connectionId: connection.id,
      timestamp: new Date().toISOString(),
      direction: 'server->client',
      type: 'ACK',
      payload: `ACK ack=${connection.seqNum + 1}`,
      size: 32
    });

    connection.state = TCP_STATES.FIN_WAIT_2;

    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'TCP_FIN_ACK',
      source: 'server',
      target: `client-${connection.clientId}`,
      payload: `ACK ack=${connection.seqNum + 1}`,
      details: '服务器确认 FIN，进入半关闭状态'
    });

    await this.delay(500);

    this.emit('packet', {
      experimentId: this.experimentId,
      connectionId: connection.id,
      timestamp: new Date().toISOString(),
      direction: 'server->client',
      type: 'FIN',
      payload: `FIN seq=${connection.serverSeq}`,
      size: 32
    });

    connection.state = TCP_STATES.LAST_ACK;

    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'TCP_SERVER_FIN',
      source: 'server',
      target: `client-${connection.clientId}`,
      payload: `FIN seq=${connection.serverSeq}`,
      details: '服务器发送 FIN，准备关闭'
    });

    await this.delay(connection.rtt);

    this.emit('packet', {
      experimentId: this.experimentId,
      connectionId: connection.id,
      timestamp: new Date().toISOString(),
      direction: 'client->server',
      type: 'ACK',
      payload: `ACK ack=${connection.serverSeq + 1}`,
      size: 32
    });

    connection.state = TCP_STATES.TIME_WAIT;

    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'TCP_CLOSE_ACK',
      source: `client-${connection.clientId}`,
      target: 'server',
      payload: `ACK ack=${connection.serverSeq + 1}`,
      details: '客户端确认服务器的 FIN，进入 TIME_WAIT 状态'
    });

    await this.delay(2000);

    connection.state = TCP_STATES.CLOSED;
    this.stopHeartbeat(connectionId);

    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'TCP_CONNECTION_CLOSED',
      source: 'system',
      target: 'system',
      payload: connectionId,
      details: 'TIME_WAIT 结束，连接完全关闭'
    });

    this.emit('disconnection', {
      experimentId: this.experimentId,
      connectionId,
      clientId: connection.clientId,
      state: TCP_STATES.CLOSED,
      timestamp: new Date().toISOString()
    });
  }

  getConnection(connectionId) {
    return this.connections.get(connectionId);
  }

  getAllConnections() {
    return Array.from(this.connections.values());
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  destroy() {
    for (const connection of this.connections.values()) {
      this.stopHeartbeat(connection.id);
    }
    this.connections.clear();
  }
}

module.exports = { TCPSimulator, TCP_STATES };
