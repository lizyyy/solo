const { v4: uuidv4 } = require('uuid');

const LATENCY_THRESHOLD_MS = 5000;
const WRITE_COOLDOWN_MS = 3000;
const WAIT_TIMEOUT_MS = 30000;
const WAIT_INTERVAL_MS = 100;

class Router {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.lastWriteTimestamp = {};
    this.lastWriteVersion = {};
    this.readTraces = [];
    this.writeTraces = [];
    this.degradedQueries = [];
    this.latencyAlerts = [];
  }

  recordWrite(userId, data, timestamp) {
    const version = this.dataStore.getPrimaryVersion(userId);
    this.lastWriteTimestamp[userId] = timestamp;
    this.lastWriteVersion[userId] = version;
    
    const trace = {
      id: uuidv4(),
      type: 'write',
      userId,
      version,
      timestamp,
      data
    };
    this.writeTraces.push(trace);
    
    return trace;
  }

  async decideAndRead(userId, options = {}) {
    const startTime = Date.now();
    const forcePrimary = options.forcePrimary === true;
    const strongConsistency = options.strongConsistency === true;
    const isListQuery = options.isListQuery === true;
    const traceId = options.traceId || uuidv4();
    
    const currentLatency = this.dataStore.getLatencyMs();
    const replicaVersion = this.dataStore.getReplicaVersion(userId);
    const primaryVersion = this.dataStore.getPrimaryVersion(userId);
    const hasPendingSync = primaryVersion > replicaVersion;
    
    let decision = {
      traceId,
      userId,
      currentLatencyMs: currentLatency,
      replicaVersion,
      primaryVersion,
      latencyExceedsThreshold: currentLatency > LATENCY_THRESHOLD_MS,
      hasPendingSync,
      targetDb: null,
      reason: null,
      waited: false,
      waitTimeMs: 0,
      degraded: false,
      timestamp: startTime
    };

    if (forcePrimary || strongConsistency) {
      decision.targetDb = 'primary';
      decision.reason = strongConsistency ? '强一致性读取强制走主库' : '请求强制指定主库';
      decision.waited = false;
      return await this.executeRead(decision);
    }

    const timeSinceLastWrite = startTime - (this.lastWriteTimestamp[userId] || 0);
    const needsFreshData = timeSinceLastWrite < WRITE_COOLDOWN_MS && hasPendingSync;
    
    if (needsFreshData && !isListQuery) {
      decision.targetDb = 'primary';
      decision.reason = `刚写入(${timeSinceLastWrite}ms前)，读走主库`;
      decision.waited = false;
      return await this.executeRead(decision);
    }

    if (currentLatency > LATENCY_THRESHOLD_MS) {
      if (!this.latencyAlerts.some(a => a.userId === userId && !a.resolved)) {
        this.latencyAlerts.push({
          id: uuidv4(),
          userId,
          alertTime: startTime,
          latencyMs: currentLatency,
          message: `从库延迟超过阈值(${LATENCY_THRESHOLD_MS}ms)，当前延迟: ${currentLatency}ms`,
          resolved: false
        });
      }
      
      decision.targetDb = 'primary';
      decision.reason = `从库延迟超过阈值(${currentLatency}ms > ${LATENCY_THRESHOLD_MS}ms)，自动切主库`;
      decision.degraded = true;
      
      if (!this.degradedQueries.some(d => d.userId === userId && d.timestamp > startTime - 60000)) {
        this.degradedQueries.push({
          id: uuidv4(),
          userId,
          timestamp: startTime,
          reason: '从库延迟超过阈值自动降级'
        });
      }
      
      return await this.executeRead(decision);
    }

    if (hasPendingSync) {
      decision = await this.waitForSync(decision, userId, primaryVersion);
      return await this.executeRead(decision);
    }

    decision.targetDb = 'replica';
    decision.reason = '无待同步数据，读从库';
    return await this.executeRead(decision);
  }

  async waitForSync(decision, userId, targetVersion) {
    decision.waited = true;
    decision.waitStartTime = Date.now();
    decision.reason = '有待同步数据，等待从库追上';
    
    let elapsed = 0;
    while (elapsed < WAIT_TIMEOUT_MS) {
      this.dataStore.processSync();
      const currentReplicaVersion = this.dataStore.getReplicaVersion(userId);
      
      if (currentReplicaVersion >= targetVersion) {
        decision.waitEndTime = Date.now();
        decision.waitTimeMs = decision.waitEndTime - decision.waitStartTime;
        decision.reason += ` - 已追上，等待${decision.waitTimeMs}ms`;
        decision.targetDb = 'replica';
        return decision;
      }
      
      await new Promise(r => setTimeout(r, WAIT_INTERVAL_MS));
      elapsed = Date.now() - decision.waitStartTime;
    }
    
    decision.waitEndTime = Date.now();
    decision.waitTimeMs = WAIT_TIMEOUT_MS;
    decision.degraded = true;
    decision.targetDb = 'primary';
    decision.reason += ` - 等待超时(${WAIT_TIMEOUT_MS}ms)，降级读主库`;
    
    this.degradedQueries.push({
      id: uuidv4(),
      userId,
      timestamp: Date.now(),
      reason: '等待从库追上超时，降级读主库'
    });
    
    return decision;
  }

  async executeRead(decision) {
    let result;
    if (decision.targetDb === 'primary') {
      result = this.dataStore.readPrimary(decision.userId);
    } else {
      this.dataStore.processSync();
      result = this.dataStore.readReplica(decision.userId);
    }
    
    decision.result = result;
    decision.executedAt = Date.now();
    
    this.readTraces.push(decision);
    return decision;
  }

  getReadTraces(userId) {
    if (userId) {
      return this.readTraces.filter(t => t.userId === userId);
    }
    return this.readTraces;
  }

  getWriteTraces(userId) {
    if (userId) {
      return this.writeTraces.filter(t => t.userId === userId);
    }
    return this.writeTraces;
  }

  getLatencyAlerts() {
    return this.latencyAlerts;
  }

  resolveLatencyAlert(alertId) {
    const alert = this.latencyAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
    }
    return alert;
  }

  getLatencyReport() {
    const totalReads = this.readTraces.length;
    const primaryReads = this.readTraces.filter(t => t.targetDb === 'primary').length;
    const replicaReads = this.readTraces.filter(t => t.targetDb === 'replica').length;
    const waitedReads = this.readTraces.filter(t => t.waited).length;
    const degradedReads = this.readTraces.filter(t => t.degraded).length;
    const avgLatency = totalReads > 0 
      ? this.readTraces.reduce((sum, t) => sum + t.currentLatencyMs, 0) / totalReads 
      : 0;
    const avgWaitTime = waitedReads > 0 
      ? this.readTraces.filter(t => t.waited).reduce((sum, t) => sum + t.waitTimeMs, 0) / waitedReads 
      : 0;

    return {
      summary: {
        totalReads,
        primaryReads,
        replicaReads,
        waitedReads,
        degradedReads,
        avgLatencyMs: Math.round(avgLatency),
        avgWaitTimeMs: Math.round(avgWaitTime)
      },
      degradedQueries: this.degradedQueries,
      latencyAlerts: this.latencyAlerts,
      readDistribution: {
        primary: primaryReads,
        replica: replicaReads
      }
    };
  }
}

module.exports = Router;
