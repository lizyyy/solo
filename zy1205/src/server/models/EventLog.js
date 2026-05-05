const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const EventType = {
  CLUSTER_CREATED: 'CLUSTER_CREATED',
  CLUSTER_UPDATED: 'CLUSTER_UPDATED',
  CLUSTER_DELETED: 'CLUSTER_DELETED',
  
  INSTANCE_REGISTERED: 'INSTANCE_REGISTERED',
  INSTANCE_DEREGISTERED: 'INSTANCE_DEREGISTERED',
  INSTANCE_STATUS_CHANGED: 'INSTANCE_STATUS_CHANGED',
  INSTANCE_ROLE_CHANGED: 'INSTANCE_ROLE_CHANGED',
  INSTANCE_WEIGHT_CHANGED: 'INSTANCE_WEIGHT_CHANGED',
  
  MASTER_FAILOVER: 'MASTER_FAILOVER',
  MASTER_ELECTION: 'MASTER_ELECTION',
  MASTER_RECOVERED: 'MASTER_RECOVERED',
  
  LOAD_BALANCE_DECISION: 'LOAD_BALANCE_DECISION',
  REQUEST_ROUTED: 'REQUEST_ROUTED',
  
  HEALTH_CHECK_PASSED: 'HEALTH_CHECK_PASSED',
  HEALTH_CHECK_FAILED: 'HEALTH_CHECK_FAILED',
  INSTANCE_EVICTED: 'INSTANCE_EVICTED',
  INSTANCE_RESTORED: 'INSTANCE_RESTORED',
  
  CONFIG_WARNING: 'CONFIG_WARNING',
  CONFIG_ERROR: 'CONFIG_ERROR',
  
  MANUAL_OPERATION: 'MANUAL_OPERATION'
};

const EventSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

class EventLog {
  constructor(id, eventType, severity, clusterId, instanceId, message, details, timestamp) {
    this.id = id || uuidv4();
    this.eventType = eventType;
    this.severity = severity || EventSeverity.INFO;
    this.clusterId = clusterId || null;
    this.instanceId = instanceId || null;
    this.message = message;
    this.details = details || {};
    this.timestamp = timestamp || Date.now();
  }

  static fromJSON(json) {
    return new EventLog(
      json.id,
      json.eventType,
      json.severity,
      json.clusterId,
      json.instanceId,
      json.message,
      json.details,
      json.timestamp
    );
  }

  toJSON() {
    return {
      id: this.id,
      eventType: this.eventType,
      severity: this.severity,
      clusterId: this.clusterId,
      instanceId: this.instanceId,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp
    };
  }

  toMarkdown() {
    const time = dayjs(this.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS');
    const severityEmoji = {
      [EventSeverity.INFO]: 'ℹ️',
      [EventSeverity.WARNING]: '⚠️',
      [EventSeverity.ERROR]: '❌',
      [EventSeverity.CRITICAL]: '🚨'
    }[this.severity] || '📝';
    
    let md = `### ${severityEmoji} ${this.message}\n\n`;
    md += `- **时间**: ${time}\n`;
    md += `- **类型**: ${this.eventType}\n`;
    md += `- **级别**: ${this.severity}\n`;
    if (this.clusterId) {
      md += `- **集群**: ${this.clusterId}\n`;
    }
    if (this.instanceId) {
      md += `- **实例**: ${this.instanceId}\n`;
    }
    
    if (Object.keys(this.details).length > 0) {
      md += `- **详情**: \n`;
      for (const [key, value] of Object.entries(this.details)) {
        const valueStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        md += `  - ${key}: ${valueStr}\n`;
      }
    }
    md += '\n---\n\n';
    return md;
  }
}

module.exports = {
  EventLog,
  EventType,
  EventSeverity
};
