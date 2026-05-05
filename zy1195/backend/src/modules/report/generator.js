const { get, all } = require('../../config/database');
const moment = require('moment');

class ReportGenerator {
  async generateReport(experimentId, format = 'markdown') {
    const experiment = await this.getExperimentDetails(experimentId);
    if (!experiment) {
      throw new Error('实验不存在');
    }

    const events = await this.getExperimentEvents(experimentId);
    const packets = await this.getExperimentPackets(experimentId);
    const connections = await this.getExperimentConnections(experimentId);
    const statistics = this.calculateStatistics(experiment, events, packets, connections);
    const anomalies = this.detectAnomalies(events, packets);
    const stateMachine = this.buildStateMachine(experiment, connections, events);

    if (format === 'json') {
      return this.generateJSONReport(experiment, events, packets, connections, statistics, anomalies, stateMachine);
    }

    return this.generateMarkdownReport(experiment, events, packets, connections, statistics, anomalies, stateMachine);
  }

  async getExperimentDetails(experimentId) {
    const row = await get('SELECT * FROM experiments WHERE id = ?', [experimentId]);
    if (!row) return null;

    return {
      ...row,
      config: JSON.parse(row.config),
      statistics: row.statistics ? JSON.parse(row.statistics) : null
    };
  }

  async getExperimentEvents(experimentId) {
    return await all(
      'SELECT * FROM events WHERE experiment_id = ? ORDER BY timestamp ASC',
      [experimentId]
    );
  }

  async getExperimentPackets(experimentId) {
    return await all(
      'SELECT * FROM packets WHERE experiment_id = ? ORDER BY timestamp ASC',
      [experimentId]
    );
  }

  async getExperimentConnections(experimentId) {
    return await all(
      'SELECT * FROM connections WHERE experiment_id = ? ORDER BY created_at ASC',
      [experimentId]
    );
  }

  calculateStatistics(experiment, events, packets, connections) {
    const startedAt = experiment.started_at ? moment(experiment.started_at) : null;
    const finishedAt = experiment.finished_at ? moment(experiment.finished_at) : null;
    const duration = startedAt && finishedAt 
      ? finishedAt.diff(startedAt, 'milliseconds') 
      : 0;

    const tcpEvents = events.filter(e => e.type.startsWith('TCP_'));
    const udpEvents = events.filter(e => e.type.startsWith('UDP_'));
    
    const timeouts = events.filter(e => e.type === 'CONNECTION_TIMEOUT').length;
    const reconnects = events.filter(e => e.type === 'RECONNECT_ATTEMPT').length;
    const packetLoss = events.filter(e => e.type === 'UDP_PACKET_LOSS' || e.type === 'UDP_PACKET_LOST').length;
    const outOfOrder = events.filter(e => e.type === 'UDP_OUT_OF_ORDER').length;
    const stickyPackets = events.filter(e => e.type === 'STICKY_PACKET').length;

    const clientToServerPackets = packets.filter(p => p.direction === 'client->server').length;
    const serverToClientPackets = packets.filter(p => p.direction === 'server->client').length;
    
    const totalBytes = packets.reduce((sum, p) => sum + (p.size || 0), 0);
    const avgPacketSize = packets.length > 0 ? Math.round(totalBytes / packets.length) : 0;

    const eventTypes = {};
    events.forEach(e => {
      eventTypes[e.type] = (eventTypes[e.type] || 0) + 1;
    });

    return {
      basic: {
        experimentId: experiment.id,
        name: experiment.name,
        protocol: experiment.protocol,
        status: experiment.status,
        startTime: experiment.started_at,
        endTime: experiment.finished_at,
        durationMs: duration,
        durationReadable: this.formatDuration(duration)
      },
      config: experiment.config,
      connections: {
        total: connections.length,
        established: connections.filter(c => c.state === 'ESTABLISHED' || c.state === 'CLOSED').length,
        closed: connections.filter(c => c.state === 'CLOSED').length
      },
      packets: {
        total: packets.length,
        clientToServer: clientToServerPackets,
        serverToClient: serverToClientPackets,
        totalBytes,
        avgPacketSize,
        byType: this.groupBy(packets, 'type')
      },
      events: {
        total: events.length,
        tcpEvents: tcpEvents.length,
        udpEvents: udpEvents.length,
        byType: eventTypes
      },
      issues: {
        timeouts,
        reconnects,
        packetLoss,
        outOfOrder,
        stickyPackets
      }
    };
  }

  detectAnomalies(events, packets) {
    const anomalies = [];

    const timeouts = events.filter(e => e.type === 'CONNECTION_TIMEOUT');
    timeouts.forEach(e => {
      anomalies.push({
        severity: 'warning',
        category: 'timeout',
        timestamp: e.timestamp,
        message: `连接超时: ${e.details}`,
        source: e.source,
        target: e.target
      });
    });

    const reconnectFailures = events.filter(e => e.type === 'RECONNECT_FAILED');
    reconnectFailures.forEach(e => {
      anomalies.push({
        severity: 'warning',
        category: 'reconnect',
        timestamp: e.timestamp,
        message: `重连失败: ${e.details}`,
        source: e.source,
        target: e.target
      });
    });

    const packetLoss = events.filter(e => 
      e.type === 'UDP_PACKET_LOSS' || e.type === 'UDP_PACKET_LOST'
    );
    packetLoss.forEach(e => {
      anomalies.push({
        severity: 'warning',
        category: 'packet_loss',
        timestamp: e.timestamp,
        message: `数据报丢失: ${e.details}`,
        source: e.source,
        target: e.target
      });
    });

    const outOfOrder = events.filter(e => e.type === 'UDP_OUT_OF_ORDER');
    outOfOrder.forEach(e => {
      anomalies.push({
        severity: 'info',
        category: 'out_of_order',
        timestamp: e.timestamp,
        message: `数据报乱序: ${e.details}`,
        source: e.source,
        target: e.target
      });
    });

    const reconnectExhausted = events.filter(e => e.type === 'RECONNECT_EXHAUSTED');
    reconnectExhausted.forEach(e => {
      anomalies.push({
        severity: 'error',
        category: 'reconnect_exhausted',
        timestamp: e.timestamp,
        message: `重连次数耗尽: ${e.details}`,
        source: e.source,
        target: e.target
      });
    });

    return anomalies.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  buildStateMachine(experiment, connections, events) {
    const isTCP = experiment.protocol === 'TCP';
    
    if (isTCP) {
      return this.buildTCPStateMachine(connections, events);
    }
    
    return this.buildUDPStateMachine(events);
  }

  buildTCPStateMachine(connections, events) {
    const states = [
      'CLOSED', 'LISTEN', 'SYN_SENT', 'SYN_RCVD', 
      'ESTABLISHED', 'FIN_WAIT_1', 'FIN_WAIT_2', 
      'CLOSE_WAIT', 'CLOSING', 'LAST_ACK', 'TIME_WAIT'
    ];

    const transitions = [];
    const stateCounts = {};

    states.forEach(s => stateCounts[s] = 0);

    events.forEach(e => {
      if (e.type === 'TCP_SYN_SENT') {
        transitions.push({ from: 'CLOSED', to: 'SYN_SENT', event: 'SYN_SEND' });
        stateCounts['SYN_SENT']++;
      } else if (e.type === 'TCP_SYN_ACK') {
        transitions.push({ from: 'SYN_SENT', to: 'SYN_RCVD', event: 'SYN_ACK_RECV' });
        stateCounts['SYN_RCVD']++;
      } else if (e.type === 'TCP_ACK') {
        transitions.push({ from: 'SYN_RCVD', to: 'ESTABLISHED', event: 'ACK_RECV' });
        stateCounts['ESTABLISHED']++;
      } else if (e.type === 'TCP_FIN_SENT') {
        transitions.push({ from: 'ESTABLISHED', to: 'FIN_WAIT_1', event: 'FIN_SEND' });
        stateCounts['FIN_WAIT_1']++;
      } else if (e.type === 'TCP_FIN_ACK') {
        transitions.push({ from: 'FIN_WAIT_1', to: 'FIN_WAIT_2', event: 'ACK_RECV' });
        stateCounts['FIN_WAIT_2']++;
      } else if (e.type === 'TCP_SERVER_FIN') {
        transitions.push({ from: 'FIN_WAIT_2', to: 'TIME_WAIT', event: 'FIN_RECV' });
        stateCounts['TIME_WAIT']++;
      } else if (e.type === 'TCP_CONNECTION_CLOSED') {
        transitions.push({ from: 'TIME_WAIT', to: 'CLOSED', event: '2MSL_TIMEOUT' });
        stateCounts['CLOSED']++;
      }
    });

    return {
      protocol: 'TCP',
      states,
      transitions: this.uniqueTransitions(transitions),
      stateCounts,
      diagram: this.generateTCPDiagram()
    };
  }

  buildUDPStateMachine(events) {
    const states = ['IDLE', 'SENDING', 'WAITING', 'RECEIVING', 'ERROR'];
    
    const transitions = [];
    const eventCounts = {
      send: 0,
      receive: 0,
      loss: 0,
      duplicate: 0
    };

    events.forEach(e => {
      if (e.type === 'UDP_SEND') {
        transitions.push({ from: 'IDLE', to: 'SENDING', event: 'SEND_DATAGRAM' });
        eventCounts.send++;
      } else if (e.type === 'UDP_DELIVERED') {
        transitions.push({ from: 'SENDING', to: 'RECEIVING', event: 'RECV_RESPONSE' });
        eventCounts.receive++;
      } else if (e.type === 'UDP_PACKET_LOSS' || e.type === 'UDP_PACKET_LOST') {
        transitions.push({ from: 'SENDING', to: 'IDLE', event: 'PACKET_LOST' });
        eventCounts.loss++;
      } else if (e.type === 'UDP_PACKET_DUPLICATE') {
        transitions.push({ from: 'RECEIVING', to: 'RECEIVING', event: 'DUPLICATE_RECV' });
        eventCounts.duplicate++;
      }
    });

    return {
      protocol: 'UDP',
      states,
      transitions: this.uniqueTransitions(transitions),
      eventCounts,
      characteristics: [
        '无连接：无需建立连接',
        '不可靠：不保证送达、顺序、无重复',
        '数据报边界：每个消息独立',
        '无流量控制、无拥塞控制',
        '头部开销小（8字节）'
      ]
    };
  }

  generateTCPDiagram() {
    return `
      +--------+       send SYN        +----------+
      | CLOSED | --------------------> | SYN_SENT |
      +--------+                       +----------+
           ^                                 |
           |          recv SYN, send ACK    |
           |          +----------------------+
           |          v
      +---------+  recv SYN+ACK, send ACK  +----------+
      |  LISTEN | <------------------------ | SYN_RCVD |
      +---------+                           +----------+
           |                                       |
           |          send ACK (3-way handshake)  |
           |          +----------------------------+
           |          v
           |    +-------------+
           |    | ESTABLISHED | <--- 数据传输阶段 --->
           |    +-------------+
           |          |
           |   send FIN|
           |          v
      +--------+   recv ACK    +----------+
      | CLOSED | <----------- | FIN_WAIT_1|
      +--------+              +----------+
           ^                        |
           |                   recv FIN
           |                        v
           |              +----------+
           +------------- | TIME_WAIT|
      2MSL timeout         +----------+
    `;
  }

  generateMarkdownReport(experiment, events, packets, connections, statistics, anomalies, stateMachine) {
    const lines = [];

    lines.push(`# 网络协议实验报告`);
    lines.push(``);
    lines.push(`## 基本信息`);
    lines.push(``);
    lines.push(`| 项目 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 实验ID | ${experiment.id} |`);
    lines.push(`| 实验名称 | ${experiment.name} |`);
    lines.push(`| 协议类型 | ${experiment.protocol} |`);
    lines.push(`| 实验状态 | ${experiment.status} |`);
    lines.push(`| 开始时间 | ${experiment.started_at || '未开始'} |`);
    lines.push(`| 结束时间 | ${experiment.finished_at || '未结束'} |`);
    lines.push(`| 持续时间 | ${statistics.basic.durationReadable} |`);
    lines.push(``);

    lines.push(`## 实验配置`);
    lines.push(``);
    lines.push(`\`\`\`json`);
    lines.push(JSON.stringify(experiment.config, null, 2));
    lines.push(`\`\`\``);
    lines.push(``);

    lines.push(`## 统计指标`);
    lines.push(``);
    lines.push(`### 连接统计`);
    lines.push(`- 总连接数: ${statistics.connections.total}`);
    lines.push(`- 已建立: ${statistics.connections.established}`);
    lines.push(`- 已关闭: ${statistics.connections.closed}`);
    lines.push(``);

    lines.push(`### 报文统计`);
    lines.push(`- 总报文数: ${statistics.packets.total}`);
    lines.push(`- 客户端->服务器: ${statistics.packets.clientToServer}`);
    lines.push(`- 服务器->客户端: ${statistics.packets.serverToClient}`);
    lines.push(`- 总字节数: ${statistics.packets.totalBytes} bytes`);
    lines.push(`- 平均报文大小: ${statistics.packets.avgPacketSize} bytes`);
    lines.push(``);

    lines.push(`### 事件统计`);
    lines.push(`- 总事件数: ${statistics.events.total}`);
    lines.push(`- TCP 事件: ${statistics.events.tcpEvents}`);
    lines.push(`- UDP 事件: ${statistics.events.udpEvents}`);
    lines.push(``);

    lines.push(`### 异常统计`);
    lines.push(`- 连接超时: ${statistics.issues.timeouts}`);
    lines.push(`- 重连尝试: ${statistics.issues.reconnects}`);
    lines.push(`- 报文丢失: ${statistics.issues.packetLoss}`);
    lines.push(`- 乱序到达: ${statistics.issues.outOfOrder}`);
    lines.push(`- 粘包演示: ${statistics.issues.stickyPackets}`);
    lines.push(``);

    if (anomalies.length > 0) {
      lines.push(`## 异常提示`);
      lines.push(``);
      
      anomalies.forEach(a => {
        const icon = a.severity === 'error' ? '🔴' : a.severity === 'warning' ? '🟡' : '🔵';
        lines.push(`### ${icon} ${a.category.toUpperCase()}`);
        lines.push(`- 时间: ${a.timestamp}`);
        lines.push(`- 消息: ${a.message}`);
        if (a.source) lines.push(`- 来源: ${a.source}`);
        if (a.target) lines.push(`- 目标: ${a.target}`);
        lines.push(``);
      });
    }

    lines.push(`## 状态机`);
    lines.push(``);
    if (stateMachine.protocol === 'TCP') {
      lines.push(`### TCP 状态转换图`);
      lines.push(``);
      lines.push(`\`\`\``);
      lines.push(stateMachine.diagram.trim());
      lines.push(`\`\`\``);
      lines.push(``);
      
      lines.push(`### 状态转换记录`);
      lines.push(``);
      lines.push(`| 源状态 | 目标状态 | 触发事件 |`);
      lines.push(`|--------|----------|----------|`);
      stateMachine.transitions.forEach(t => {
        lines.push(`| ${t.from} | ${t.to} | ${t.event} |`);
      });
    } else {
      lines.push(`### UDP 特性说明`);
      lines.push(``);
      stateMachine.characteristics.forEach(c => {
        lines.push(`- ${c}`);
      });
      lines.push(``);
      
      lines.push(`### 事件统计`);
      lines.push(`- 发送: ${stateMachine.eventCounts.send}`);
      lines.push(`- 接收: ${stateMachine.eventCounts.receive}`);
      lines.push(`- 丢失: ${stateMachine.eventCounts.loss}`);
      lines.push(`- 重复: ${stateMachine.eventCounts.duplicate}`);
    }
    lines.push(``);

    lines.push(`## 事件时间线`);
    lines.push(``);
    
    const maxEvents = 50;
    const displayEvents = events.slice(0, maxEvents);
    
    displayEvents.forEach((e, i) => {
      const time = moment(e.timestamp).format('HH:mm:ss.SSS');
      lines.push(`${i + 1}. \`${time}\` **${e.type}**`);
      lines.push(`   - ${e.details}`);
      if (e.source || e.target) {
        const parts = [];
        if (e.source) parts.push(`源: ${e.source}`);
        if (e.target) parts.push(`目标: ${e.target}`);
        lines.push(`   - ${parts.join(' | ')}`);
      }
      if (e.payload) {
        lines.push(`   - 数据: ${e.payload}`);
      }
      lines.push(``);
    });

    if (events.length > maxEvents) {
      lines.push(`> 共 ${events.length} 个事件，以上显示前 ${maxEvents} 个`);
      lines.push(``);
    }

    lines.push(`## 报文流`);
    lines.push(``);
    lines.push(`| 时间 | 方向 | 类型 | 大小 | 内容 |`);
    lines.push(`|------|------|------|------|------|`);
    
    packets.slice(0, 30).forEach(p => {
      const time = moment(p.timestamp).format('HH:mm:ss.SSS');
      const size = p.size || '-';
      const payload = (p.payload || '').slice(0, 50);
      lines.push(`| ${time} | ${p.direction} | ${p.type} | ${size} | ${payload} |`);
    });

    if (packets.length > 30) {
      lines.push(``);
      lines.push(`> 共 ${packets.length} 个报文，以上显示前 30 个`);
    }

    lines.push(``);
    lines.push(`---`);
    lines.push(`*报告生成时间: ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  generateJSONReport(experiment, events, packets, connections, statistics, anomalies, stateMachine) {
    return {
      reportVersion: '1.0',
      generatedAt: new Date().toISOString(),
      experiment: {
        id: experiment.id,
        name: experiment.name,
        protocol: experiment.protocol,
        status: experiment.status,
        config: experiment.config,
        startedAt: experiment.started_at,
        finishedAt: experiment.finished_at
      },
      statistics,
      anomalies,
      stateMachine,
      timeline: {
        events: events.slice(0, 100),
        packets: packets.slice(0, 100),
        connections
      }
    };
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return `${minutes}m ${seconds}s`;
  }

  groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const k = item[key];
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  }

  uniqueTransitions(transitions) {
    const seen = new Set();
    return transitions.filter(t => {
      const key = `${t.from}-${t.to}-${t.event}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

module.exports = { ReportGenerator };
