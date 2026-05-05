const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class UDPSimulator extends EventEmitter {
  constructor(config, experimentId) {
    super();
    this.config = config;
    this.experimentId = experimentId;
    this.clients = new Map();
    this.serverPort = 8888;
  }

  createClient(clientId) {
    const client = {
      id: clientId,
      port: 10000 + Math.floor(Math.random() * 1000),
      lastActivity: Date.now(),
      sentPackets: 0,
      receivedPackets: 0,
      lostPackets: 0,
      outOfOrderPackets: 0
    };
    this.clients.set(clientId, client);
    return client;
  }

  async sendDatagram(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error('客户端不存在');
    }

    const datagramId = uuidv4();
    const timestamp = new Date().toISOString();

    this.emit('packet', {
      experimentId: this.experimentId,
      connectionId: `udp-${clientId}`,
      timestamp,
      direction: 'client->server',
      type: 'UDP_DATAGRAM',
      payload: JSON.stringify(data),
      size: 8 + (data ? data.length : 0)
    });

    this.emit('event', {
      experimentId: this.experimentId,
      timestamp,
      type: 'UDP_SEND',
      source: `client-${clientId}:${client.port}`,
      target: `server:${this.serverPort}`,
      payload: JSON.stringify(data),
      details: `发送 UDP 数据报，长度: ${data ? data.length : 0} 字节`
    });

    client.sentPackets++;
    client.lastActivity = Date.now();

    const lossRate = this.config.lossRate || 0;
    const shouldLose = Math.random() < lossRate;

    if (shouldLose) {
      client.lostPackets++;
      this.emit('event', {
        experimentId: this.experimentId,
        timestamp: new Date().toISOString(),
        type: 'UDP_PACKET_LOSS',
        source: 'network',
        target: 'system',
        payload: datagramId,
        details: `UDP 数据报丢失（丢包率: ${lossRate * 100}%）`
      });
      return { delivered: false, reason: 'packet_loss' };
    }

    const delayVariation = this.config.delayVariation || 100;
    const baseDelay = this.config.rtt || 100;
    const actualDelay = baseDelay + Math.random() * delayVariation - delayVariation / 2;

    await this.delay(Math.max(10, actualDelay));

    client.receivedPackets++;

    this.emit('packet', {
      experimentId: this.experimentId,
      connectionId: `udp-${clientId}`,
      timestamp: new Date().toISOString(),
      direction: 'server->client',
      type: 'UDP_RESPONSE',
      payload: 'ACK',
      size: 8
    });

    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'UDP_DELIVERED',
      source: `server:${this.serverPort}`,
      target: `client-${clientId}:${client.port}`,
      payload: datagramId,
      details: `UDP 数据报成功送达，延迟: ${actualDelay.toFixed(0)}ms`
    });

    return { delivered: true, delay: actualDelay };
  }

  async sendMultipleDatagrams(clientId, messages, enableOutOfOrder = false) {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error('客户端不存在');
    }

    const results = [];
    const expectedOrder = messages.map((_, i) => i);
    let actualOrder = [];

    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'UDP_BATCH_SEND',
      source: `client-${clientId}`,
      target: 'server',
      payload: `count=${messages.length}, out_of_order=${enableOutOfOrder}`,
      details: `批量发送 ${messages.length} 个 UDP 数据报${enableOutOfOrder ? '（模拟乱序）' : ''}`
    });

    for (let i = 0; i < messages.length; i++) {
      const result = await this.sendDatagram(clientId, messages[i]);
      results.push({ index: i, message: messages[i], ...result });
      actualOrder.push(i);
    }

    if (enableOutOfOrder && Math.random() < 0.3) {
      const shuffled = [...actualOrder];
      const idx1 = Math.floor(Math.random() * shuffled.length);
      const idx2 = (idx1 + 1) % shuffled.length;
      [shuffled[idx1], shuffled[idx2]] = [shuffled[idx2], shuffled[idx1]];
      
      client.outOfOrderPackets += 2;
      
      this.emit('event', {
        experimentId: this.experimentId,
        timestamp: new Date().toISOString(),
        type: 'UDP_OUT_OF_ORDER',
        source: 'network',
        target: 'server',
        payload: `expected=[${expectedOrder}], actual=[${shuffled}]`,
        details: `UDP 数据报乱序到达：期望顺序 ${expectedOrder}，实际顺序 ${shuffled}`
      });
      
      actualOrder = shuffled;
    }

    return {
      results,
      expectedOrder,
      actualOrder,
      isOutOfOrder: JSON.stringify(expectedOrder) !== JSON.stringify(actualOrder)
    };
  }

  demonstratePacketBoundaries(clientId) {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error('客户端不存在');
    }

    const messages = ['Hello', 'World', 'UDP', 'Boundaries'];

    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'UDP_BOUNDARY_DEMO',
      source: `client-${clientId}`,
      target: 'server',
      payload: JSON.stringify(messages),
      details: `演示 UDP 数据报边界：${messages.length} 个独立消息作为 ${messages.length} 个独立数据报发送`
    });

    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'UDP_BOUNDARY_EXPLAIN',
      source: 'system',
      target: 'system',
      payload: `UDP: 每个 sendto() 都是独立数据报，有明确边界；TCP: 字节流，无边界，可能粘包`,
      details: `UDP vs TCP 边界对比：
- UDP：数据报模式，每次发送的消息都有明确边界，接收时要么完整收到，要么丢包
- TCP：字节流模式，无消息边界，应用层需要自己处理粘包拆包问题`
    });

    return messages;
  }

  async simulateUnreliableTransmission(clientId, messages, config = {}) {
    const {
      lossRate = 0.1,
      duplicateRate = 0.05,
      delayVariation = 200
    } = config;

    const results = [];

    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'UDP_UNRELIABLE_DEMO',
      source: 'system',
      target: 'system',
      payload: `loss=${lossRate * 100}%, duplicate=${duplicateRate * 100}%, jitter=${delayVariation}ms`,
      details: `演示 UDP 不可靠传输特性：丢包、重复、延迟抖动`
    });

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const delay = 50 + Math.random() * delayVariation;

      await this.delay(delay);

      const isLost = Math.random() < lossRate;
      const isDuplicate = !isLost && Math.random() < duplicateRate;

      if (isLost) {
        results.push({
          index: i,
          message,
          status: 'lost',
          delay: null
        });

        this.emit('event', {
          experimentId: this.experimentId,
          timestamp: new Date().toISOString(),
          type: 'UDP_PACKET_LOST',
          source: 'network',
          target: 'server',
          payload: message,
          details: `数据报 [${i}] 丢失`
        });
      } else {
        results.push({
          index: i,
          message,
          status: 'delivered',
          delay
        });

        this.emit('event', {
          experimentId: this.experimentId,
          timestamp: new Date().toISOString(),
          type: 'UDP_PACKET_DELIVERED',
          source: `client-${clientId}`,
          target: 'server',
          payload: message,
          details: `数据报 [${i}] 送达，延迟 ${delay.toFixed(0)}ms`
        });

        if (isDuplicate) {
          results.push({
            index: i,
            message,
            status: 'duplicate',
            delay: delay + 100
          });

          this.emit('event', {
            experimentId: this.experimentId,
            timestamp: new Date().toISOString(),
            type: 'UDP_PACKET_DUPLICATE',
            source: 'network',
            target: 'server',
            payload: message,
            details: `数据报 [${i}] 重复到达`
          });
        }
      }
    }

    const stats = {
      total: messages.length,
      delivered: results.filter(r => r.status === 'delivered').length,
      lost: results.filter(r => r.status === 'lost').length,
      duplicate: results.filter(r => r.status === 'duplicate').length
    };

    this.emit('event', {
      experimentId: this.experimentId,
      timestamp: new Date().toISOString(),
      type: 'UDP_UNRELIABLE_SUMMARY',
      source: 'system',
      target: 'system',
      payload: JSON.stringify(stats),
      details: `不可靠传输统计：总计 ${stats.total}，送达 ${stats.delivered}，丢失 ${stats.lost}，重复 ${stats.duplicate}`
    });

    return { results, stats };
  }

  getClient(clientId) {
    return this.clients.get(clientId);
  }

  getAllClients() {
    return Array.from(this.clients.values());
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  destroy() {
    this.clients.clear();
  }
}

module.exports = { UDPSimulator };
