const { v4: uuidv4 } = require('uuid');

const InstanceStatus = {
  HEALTHY: 'HEALTHY',
  UNHEALTHY: 'UNHEALTHY',
  DOWN: 'DOWN',
  MAINTENANCE: 'MAINTENANCE'
};

const InstanceRole = {
  MASTER: 'MASTER',
  SLAVE: 'SLAVE',
  FOLLOWER: 'FOLLOWER'
};

class Instance {
  constructor(id, clusterId, name, host, port, role, weight, status) {
    this.id = id || uuidv4();
    this.clusterId = clusterId;
    this.name = name;
    this.host = host;
    this.port = port;
    this.role = role || InstanceRole.SLAVE;
    this.weight = weight || 1;
    this.status = status || InstanceStatus.HEALTHY;
    this.connections = 0;
    this.lastHealthCheckTime = null;
    this.failedHealthChecks = 0;
    this.registeredAt = Date.now();
    this.lastStatusChangeTime = null;
  }

  static fromJSON(json) {
    const instance = new Instance(
      json.id,
      json.clusterId,
      json.name,
      json.host,
      json.port,
      json.role,
      json.weight,
      json.status
    );
    instance.connections = json.connections || 0;
    instance.lastHealthCheckTime = json.lastHealthCheckTime || null;
    instance.failedHealthChecks = json.failedHealthChecks || 0;
    instance.registeredAt = json.registeredAt || Date.now();
    instance.lastStatusChangeTime = json.lastStatusChangeTime || null;
    return instance;
  }

  toJSON() {
    return {
      id: this.id,
      clusterId: this.clusterId,
      name: this.name,
      host: this.host,
      port: this.port,
      role: this.role,
      weight: this.weight,
      status: this.status,
      connections: this.connections,
      lastHealthCheckTime: this.lastHealthCheckTime,
      failedHealthChecks: this.failedHealthChecks,
      registeredAt: this.registeredAt,
      lastStatusChangeTime: this.lastStatusChangeTime
    };
  }

  isAvailable() {
    return this.status === InstanceStatus.HEALTHY;
  }

  isMaster() {
    return this.role === InstanceRole.MASTER;
  }

  setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.lastStatusChangeTime = Date.now();
    }
  }

  incrementConnections() {
    this.connections++;
  }

  decrementConnections() {
    if (this.connections > 0) {
      this.connections--;
    }
  }

  validate() {
    const errors = [];
    
    if (!this.name || this.name.trim() === '') {
      errors.push('实例名称不能为空');
    }
    
    if (!this.clusterId) {
      errors.push('实例必须关联集群');
    }
    
    if (!this.host || this.host.trim() === '') {
      errors.push('主机地址不能为空');
    }
    
    if (!this.port || this.port <= 0 || this.port > 65535) {
      errors.push('端口号必须在1-65535之间');
    }
    
    if (!Object.values(InstanceStatus).includes(this.status)) {
      errors.push(`不支持的实例状态: ${this.status}，支持的状态: ${Object.values(InstanceStatus).join(', ')}`);
    }
    
    if (!Object.values(InstanceRole).includes(this.role)) {
      errors.push(`不支持的实例角色: ${this.role}，支持的角色: ${Object.values(InstanceRole).join(', ')}`);
    }
    
    if (this.weight < 1 || this.weight > 100) {
      errors.push('权重应在1-100之间');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = {
  Instance,
  InstanceStatus,
  InstanceRole
};
