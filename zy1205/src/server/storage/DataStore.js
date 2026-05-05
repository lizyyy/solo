const fs = require('fs');
const path = require('path');
const Cluster = require('../models/Cluster');
const { Instance } = require('../models/Instance');
const { EventLog } = require('../models/EventLog');

const STORAGE_DIR = path.join(__dirname, '../../../data');

class DataStore {
  constructor() {
    this.ensureStorageDir();
    this._clusters = this.loadFromFile('clusters.json', []);
    this._instances = this.loadFromFile('instances.json', []);
    this._eventLogs = this.loadFromFile('eventLogs.json', []);
  }

  ensureStorageDir() {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  loadFromFile(filename, defaultValue) {
    const filePath = path.join(STORAGE_DIR, filename);
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`Error loading ${filename}:`, error.message);
    }
    return defaultValue;
  }

  saveToFile(filename, data) {
    const filePath = path.join(STORAGE_DIR, filename);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error saving ${filename}:`, error.message);
    }
  }

  saveAll() {
    this.saveToFile('clusters.json', this._clusters);
    this.saveToFile('instances.json', this._instances);
    this.saveToFile('eventLogs.json', this._eventLogs);
  }

  // 集群操作
  getClusters() {
    return this._clusters.map(c => Cluster.fromJSON(c));
  }

  getClusterById(id) {
    const cluster = this._clusters.find(c => c.id === id);
    return cluster ? Cluster.fromJSON(cluster) : null;
  }

  createCluster(cluster) {
    this._clusters.push(cluster.toJSON());
    this.saveAll();
    return cluster;
  }

  updateCluster(id, updateData) {
    const index = this._clusters.findIndex(c => c.id === id);
    if (index !== -1) {
      this._clusters[index] = {
        ...this._clusters[index],
        ...updateData,
        updatedAt: Date.now()
      };
      this.saveAll();
      return Cluster.fromJSON(this._clusters[index]);
    }
    return null;
  }

  deleteCluster(id) {
    const index = this._clusters.findIndex(c => c.id === id);
    if (index !== -1) {
      this._clusters.splice(index, 1);
      this._instances = this._instances.filter(i => i.clusterId !== id);
      this.saveAll();
      return true;
    }
    return false;
  }

  // 实例操作
  getInstances() {
    return this._instances.map(i => Instance.fromJSON(i));
  }

  getInstancesByClusterId(clusterId) {
    return this._instances
      .filter(i => i.clusterId === clusterId)
      .map(i => Instance.fromJSON(i));
  }

  getInstanceById(id) {
    const instance = this._instances.find(i => i.id === id);
    return instance ? Instance.fromJSON(instance) : null;
  }

  createInstance(instance) {
    this._instances.push(instance.toJSON());
    this.saveAll();
    return instance;
  }

  updateInstance(id, updateData) {
    const index = this._instances.findIndex(i => i.id === id);
    if (index !== -1) {
      this._instances[index] = {
        ...this._instances[index],
        ...updateData
      };
      this.saveAll();
      return Instance.fromJSON(this._instances[index]);
    }
    return null;
  }

  deleteInstance(id) {
    const index = this._instances.findIndex(i => i.id === id);
    if (index !== -1) {
      this._instances.splice(index, 1);
      this.saveAll();
      return true;
    }
    return false;
  }

  // 事件日志操作
  getEventLogs(options = {}) {
    const { clusterId, instanceId, eventType, severity, limit, offset } = options;
    
    let logs = this._eventLogs.slice();
    
    if (clusterId) {
      logs = logs.filter(l => l.clusterId === clusterId);
    }
    if (instanceId) {
      logs = logs.filter(l => l.instanceId === instanceId);
    }
    if (eventType) {
      logs = logs.filter(l => l.eventType === eventType);
    }
    if (severity) {
      logs = logs.filter(l => l.severity === severity);
    }
    
    // 按时间倒序
    logs.sort((a, b) => b.timestamp - a.timestamp);
    
    // 分页
    if (offset !== undefined) {
      logs = logs.slice(offset);
    }
    if (limit !== undefined) {
      logs = logs.slice(0, limit);
    }
    
    return logs.map(l => EventLog.fromJSON(l));
  }

  addEventLog(eventLog) {
    this._eventLogs.push(eventLog.toJSON());
    this.saveAll();
    return eventLog;
  }

  clearEventLogs(clusterId = null) {
    if (clusterId) {
      this._eventLogs = this._eventLogs.filter(l => l.clusterId !== clusterId);
    } else {
      this._eventLogs = [];
    }
    this.saveAll();
  }

  // 导出所有数据
  exportAll() {
    return {
      clusters: this._clusters,
      instances: this._instances,
      eventLogs: this._eventLogs,
      exportedAt: Date.now()
    };
  }

  importAll(data) {
    try {
      this._clusters = data.clusters || [];
      this._instances = data.instances || [];
      this._eventLogs = data.eventLogs || [];
      this.saveAll();
      return true;
    } catch (error) {
      console.error('Import failed:', error);
      return false;
    }
  }
}

module.exports = new DataStore();
