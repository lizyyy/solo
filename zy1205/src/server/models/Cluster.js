const { v4: uuidv4 } = require('uuid');

class Cluster {
  constructor(id, name, description, loadBalancerStrategy, healthCheckInterval) {
    this.id = id || uuidv4();
    this.name = name;
    this.description = description || '';
    this.loadBalancerStrategy = loadBalancerStrategy || 'ROUND_ROBIN';
    this.healthCheckInterval = healthCheckInterval || 30000;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  static fromJSON(json) {
    const cluster = new Cluster(
      json.id,
      json.name,
      json.description,
      json.loadBalancerStrategy,
      json.healthCheckInterval
    );
    cluster.createdAt = json.createdAt || Date.now();
    cluster.updatedAt = json.updatedAt || Date.now();
    return cluster;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      loadBalancerStrategy: this.loadBalancerStrategy,
      healthCheckInterval: this.healthCheckInterval,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  validate() {
    const errors = [];
    
    if (!this.name || this.name.trim() === '') {
      errors.push('集群名称不能为空');
    }
    
    if (this.name && this.name.length > 100) {
      errors.push('集群名称不能超过100个字符');
    }
    
    if (!['ROUND_ROBIN', 'WEIGHTED_ROUND_ROBIN', 'LEAST_CONNECTIONS', 'RANDOM'].includes(this.loadBalancerStrategy)) {
      errors.push(`不支持的负载均衡策略: ${this.loadBalancerStrategy}，支持的策略: ROUND_ROBIN, WEIGHTED_ROUND_ROBIN, LEAST_CONNECTIONS, RANDOM`);
    }
    
    if (this.healthCheckInterval < 5000 || this.healthCheckInterval > 300000) {
      errors.push('健康检查间隔应在5秒到5分钟之间');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = Cluster;
