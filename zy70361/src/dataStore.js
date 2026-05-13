class DataStore {
  constructor() {
    this.primary = {};
    this.replica = {};
    this.replicaVersion = {};
    this.primaryVersion = {};
    this.syncLatencyMs = 0;
    this.lastSyncTimestamp = Date.now();
    this.syncQueue = [];
  }

  write(userId, data, timestamp) {
    const version = (this.primaryVersion[userId] || 0) + 1;
    this.primary[userId] = { ...data, version, updatedAt: timestamp };
    this.primaryVersion[userId] = version;
    
    this.syncQueue.push({
      userId,
      data: this.primary[userId],
      timestamp
    });
    
    return this.primary[userId];
  }

  readPrimary(userId) {
    return this.primary[userId] || null;
  }

  readReplica(userId) {
    return this.replica[userId] || null;
  }

  getReplicaVersion(userId) {
    return this.replicaVersion[userId] || 0;
  }

  getPrimaryVersion(userId) {
    return this.primaryVersion[userId] || 0;
  }

  getLatencyMs() {
    return this.syncLatencyMs;
  }

  setLatencyMs(latencyMs) {
    this.syncLatencyMs = latencyMs;
  }

  processSync() {
    if (this.syncQueue.length === 0) return [];
    
    const now = Date.now();
    const synced = [];
    
    while (this.syncQueue.length > 0) {
      const item = this.syncQueue[0];
      const elapsed = now - item.timestamp;
      
      if (elapsed >= this.syncLatencyMs) {
        this.syncQueue.shift();
        this.replica[item.userId] = { ...item.data };
        this.replicaVersion[item.userId] = item.data.version;
        this.lastSyncTimestamp = now;
        synced.push(item.userId);
      } else {
        break;
      }
    }
    
    return synced;
  }

  getSyncQueueInfo() {
    const now = Date.now();
    return this.syncQueue.map(item => ({
      userId: item.userId,
      version: item.data.version,
      remainingMs: Math.max(0, this.syncLatencyMs - (now - item.timestamp))
    }));
  }
}

module.exports = DataStore;
