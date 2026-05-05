const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../../config/database');
const { TCPSimulator, TCP_STATES } = require('../protocol/tcp');
const { UDPSimulator } = require('../protocol/udp');

const activeExperiments = new Map();

class ExperimentManager {
  constructor(wsHandler) {
    this.wsHandler = wsHandler;
  }

  async createExperiment(config) {
    const id = uuidv4();
    const now = new Date().toISOString();

    const experiment = {
      id,
      name: config.name || `实验-${now.slice(0, 10)}`,
      protocol: config.protocol,
      config: JSON.stringify({
        clientCount: config.clientCount || 1,
        sendInterval: config.sendInterval || 1000,
        messageDelimiter: config.messageDelimiter || '\n',
        heartbeatInterval: config.heartbeatInterval || 5000,
        timeoutThreshold: config.timeoutThreshold || 30000,
        reconnectStrategy: config.reconnectStrategy || 'exponential_backoff',
        maxReconnectAttempts: config.maxReconnectAttempts || 5,
        enableStickyPacketDemo: config.enableStickyPacketDemo || false,
        enableOutOfOrderDemo: config.enableOutOfOrderDemo || false,
        lossRate: config.lossRate || 0,
        enableNagle: config.enableNagle || false
      }),
      status: 'created',
      created_at: now,
      started_at: null,
      finished_at: null,
      statistics: null
    };

    await run(`
      INSERT INTO experiments (id, name, protocol, config, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [experiment.id, experiment.name, experiment.protocol, experiment.config, experiment.status, experiment.created_at]);

    return experiment;
  }

  async getExperiment(id) {
    const row = await get('SELECT * FROM experiments WHERE id = ?', [id]);
    if (!row) return null;

    return {
      ...row,
      config: JSON.parse(row.config),
      statistics: row.statistics ? JSON.parse(row.statistics) : null
    };
  }

  async getAllExperiments() {
    const rows = await all('SELECT * FROM experiments ORDER BY created_at DESC');
    return rows.map(row => ({
      ...row,
      config: JSON.parse(row.config),
      statistics: row.statistics ? JSON.parse(row.statistics) : null
    }));
  }

  async startExperiment(id) {
    const experiment = await this.getExperiment(id);
    if (!experiment) {
      throw new Error('实验不存在');
    }

    if (experiment.status === 'running') {
      throw new Error('实验已在运行中');
    }

    const now = new Date().toISOString();
    await run(
      'UPDATE experiments SET status = ?, started_at = ? WHERE id = ?',
      ['running', now, id]
    );

    experiment.status = 'running';
    experiment.started_at = now;

    const simulator = this.createSimulator(experiment);
    activeExperiments.set(id, {
      experiment,
      simulator,
      clients: [],
      statistics: {
        totalPackets: 0,
        totalBytes: 0,
        connectionEstablished: 0,
        connectionClosed: 0,
        timeouts: 0,
        reconnectAttempts: 0,
        events: []
      }
    });

    this.setupSimulatorListeners(id, simulator);

    await this.runExperimentScenario(id, experiment);

    return experiment;
  }

  createSimulator(experiment) {
    const config = experiment.config;
    
    if (experiment.protocol === 'TCP') {
      return new TCPSimulator(config, experiment.id);
    } else {
      return new UDPSimulator(config, experiment.id);
    }
  }

  setupSimulatorListeners(experimentId, simulator) {
    const active = activeExperiments.get(experimentId);
    if (!active) return;

    simulator.on('event', async (event) => {
      await this.recordEvent(event);
      active.statistics.events.push(event);
      
      if (this.wsHandler) {
        this.wsHandler.broadcast({
          type: 'event',
          experimentId,
          data: event
        });
      }
    });

    simulator.on('packet', async (packet) => {
      await this.recordPacket(packet);
      active.statistics.totalPackets++;
      active.statistics.totalBytes += packet.size || 0;
      
      if (this.wsHandler) {
        this.wsHandler.broadcast({
          type: 'packet',
          experimentId,
          data: packet
        });
      }
    });

    simulator.on('connection', async (conn) => {
      await this.recordConnection(conn);
      active.statistics.connectionEstablished++;
      
      if (this.wsHandler) {
        this.wsHandler.broadcast({
          type: 'connection',
          experimentId,
          data: conn
        });
      }
    });

    simulator.on('disconnection', async (conn) => {
      active.statistics.connectionClosed++;
      
      if (this.wsHandler) {
        this.wsHandler.broadcast({
          type: 'disconnection',
          experimentId,
          data: conn
        });
      }
    });
  }

  async recordEvent(event) {
    await run(`
      INSERT INTO events (id, experiment_id, timestamp, type, source, target, payload, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      event.experimentId,
      event.timestamp,
      event.type,
      event.source,
      event.target,
      event.payload,
      event.details
    ]);
  }

  async recordPacket(packet) {
    await run(`
      INSERT INTO packets (id, experiment_id, connection_id, timestamp, direction, type, payload, size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      packet.experimentId,
      packet.connectionId,
      packet.timestamp,
      packet.direction,
      packet.type,
      packet.payload,
      packet.size
    ]);
  }

  async recordConnection(conn) {
    await run(`
      INSERT INTO connections (id, experiment_id, client_id, state, created_at, last_activity_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      conn.connectionId,
      conn.experimentId,
      conn.clientId,
      conn.state,
      conn.timestamp,
      conn.timestamp
    ]);
  }

  async runExperimentScenario(experimentId, experiment) {
    const active = activeExperiments.get(experimentId);
    if (!active) return;

    const { simulator, statistics } = active;
    const config = experiment.config;
    const clientCount = config.clientCount;

    for (let i = 0; i < clientCount; i++) {
      const clientId = `client-${i + 1}`;

      if (experiment.protocol === 'TCP') {
        await this.runTCPScenario(simulator, clientId, config, statistics);
      } else {
        await this.runUDPScenario(simulator, clientId, config, statistics);
      }
    }

    await this.finishExperiment(experimentId);
  }

  async runTCPScenario(simulator, clientId, config, statistics) {
    const connection = await simulator.simulateThreeWayHandshake(clientId);

    if (config.heartbeatInterval > 0) {
      simulator.startHeartbeat(connection.id);
    }

    const messages = [
      'Hello, TCP!',
      'This is message 2',
      'Another message here',
      'Final message'
    ];

    for (const msg of messages) {
      await simulator.sendData(connection.id, msg);
      await this.delay(config.sendInterval);
    }

    if (config.enableStickyPacketDemo) {
      const stickyMessages = ['MSG1', 'MSG2', 'MSG3', 'MSG4'];
      const stickyData = simulator.simulateStickyPacket(connection.id, stickyMessages);
      await simulator.sendData(connection.id, stickyData[0]);
      simulator.simulateUnpacking(connection.id, stickyData[0]);
    }

    await simulator.simulateFourWayHandshake(connection.id);
  }

  async runUDPScenario(simulator, clientId, config, statistics) {
    simulator.createClient(clientId);

    const messages = [
      'Hello, UDP!',
      'Datagram 2',
      'Datagram 3',
      'Last datagram'
    ];

    for (const msg of messages) {
      await simulator.sendDatagram(clientId, msg);
      await this.delay(config.sendInterval);
    }

    if (config.enableOutOfOrderDemo) {
      await simulator.sendMultipleDatagrams(clientId, ['A', 'B', 'C', 'D'], true);
    }

    simulator.demonstratePacketBoundaries(clientId);

    if (config.lossRate > 0) {
      await simulator.simulateUnreliableTransmission(clientId, ['P1', 'P2', 'P3', 'P4', 'P5'], {
        lossRate: config.lossRate,
        duplicateRate: 0.05,
        delayVariation: 200
      });
    }
  }

  async finishExperiment(id) {
    const active = activeExperiments.get(id);
    if (!active) return;

    const now = new Date().toISOString();
    const statistics = JSON.stringify(active.statistics);

    await run(
      'UPDATE experiments SET status = ?, finished_at = ?, statistics = ? WHERE id = ?',
      ['finished', now, statistics, id]
    );

    if (active.simulator) {
      active.simulator.destroy();
    }

    activeExperiments.delete(id);

    if (this.wsHandler) {
      this.wsHandler.broadcast({
        type: 'experiment_finished',
        experimentId: id,
        data: { finished_at: now, statistics: active.statistics }
      });
    }
  }

  async getExperimentEvents(id) {
    const rows = await all(
      'SELECT * FROM events WHERE experiment_id = ? ORDER BY timestamp ASC',
      [id]
    );
    return rows;
  }

  async getExperimentPackets(id) {
    const rows = await all(
      'SELECT * FROM packets WHERE experiment_id = ? ORDER BY timestamp ASC',
      [id]
    );
    return rows;
  }

  async deleteExperiment(id) {
    const active = activeExperiments.get(id);
    if (active && active.simulator) {
      active.simulator.destroy();
      activeExperiments.delete(id);
    }

    await run('DELETE FROM events WHERE experiment_id = ?', [id]);
    await run('DELETE FROM packets WHERE experiment_id = ?', [id]);
    await run('DELETE FROM connections WHERE experiment_id = ?', [id]);
    await run('DELETE FROM experiments WHERE id = ?', [id]);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { ExperimentManager, activeExperiments };
