const dataStore = require('../storage/DataStore');
const { EventLog, EventType, EventSeverity } = require('../models/EventLog');

const LoadBalancerStrategy = {
  ROUND_ROBIN: 'ROUND_ROBIN',
  WEIGHTED_ROUND_ROBIN: 'WEIGHTED_ROUND_ROBIN',
  LEAST_CONNECTIONS: 'LEAST_CONNECTIONS',
  RANDOM: 'RANDOM'
};

class LoadBalancer {
  constructor() {
    this.roundRobinCounters = new Map();
    this.weightedCounters = new Map();
  }

  routeRequest(clusterId, requestId = null) {
    const cluster = dataStore.getClusterById(clusterId);
    if (!cluster) {
      throw new Error(`集群不存在: ${clusterId}`);
    }

    const instances = dataStore.getInstancesByClusterId(clusterId);
    const availableInstances = instances.filter(i => i.isAvailable());

    if (availableInstances.length === 0) {
      dataStore.addEventLog(new EventLog(
        null,
        EventType.LOAD_BALANCE_DECISION,
        EventSeverity.ERROR,
        clusterId,
        null,
        '负载均衡失败：没有可用的实例',
        {
          requestId,
          strategy: cluster.loadBalancerStrategy,
          totalInstances: instances.length,
          availableInstances: 0
        }
      ));
      throw new Error('没有可用的实例');
    }

    let selectedInstance;
    let decisionReason;

    switch (cluster.loadBalancerStrategy) {
      case LoadBalancerStrategy.ROUND_ROBIN:
        selectedInstance = this.roundRobin(clusterId, availableInstances);
        decisionReason = '轮询算法：按顺序依次选择下一个实例';
        break;

      case LoadBalancerStrategy.WEIGHTED_ROUND_ROBIN:
        selectedInstance = this.weightedRoundRobin(clusterId, availableInstances);
        decisionReason = '加权轮询算法：根据权重比例分配请求';
        break;

      case LoadBalancerStrategy.LEAST_CONNECTIONS:
        selectedInstance = this.leastConnections(availableInstances);
        decisionReason = '最小连接数算法：选择当前连接数最少的实例';
        break;

      case LoadBalancerStrategy.RANDOM:
        selectedInstance = this.random(availableInstances);
        decisionReason = '随机算法：从可用实例中随机选择';
        break;

      default:
        selectedInstance = this.roundRobin(clusterId, availableInstances);
        decisionReason = '默认轮询算法';
    }

    dataStore.updateInstance(selectedInstance.id, {
      connections: selectedInstance.connections + 1
    });

    dataStore.addEventLog(new EventLog(
      null,
      EventType.REQUEST_ROUTED,
      EventSeverity.INFO,
      clusterId,
      selectedInstance.id,
      `请求路由到实例 ${selectedInstance.name}`,
      {
        requestId: requestId || `auto-${Date.now()}`,
        strategy: cluster.loadBalancerStrategy,
        decisionReason,
        instance: {
          name: selectedInstance.name,
          host: selectedInstance.host,
          port: selectedInstance.port,
          role: selectedInstance.role,
          weight: selectedInstance.weight
        },
        availableInstancesCount: availableInstances.length,
        connectionCount: selectedInstance.connections + 1
      }
    ));

    return {
      instance: selectedInstance.toJSON(),
      strategy: cluster.loadBalancerStrategy,
      reason: decisionReason
    };
  }

  roundRobin(clusterId, availableInstances) {
    if (!this.roundRobinCounters.has(clusterId)) {
      this.roundRobinCounters.set(clusterId, 0);
    }

    let counter = this.roundRobinCounters.get(clusterId);
    const instance = availableInstances[counter % availableInstances.length];
    this.roundRobinCounters.set(clusterId, (counter + 1) % availableInstances.length);

    return instance;
  }

  weightedRoundRobin(clusterId, availableInstances) {
    if (!this.weightedCounters.has(clusterId)) {
      this.weightedCounters.set(clusterId, new Map());
    }

    const clusterCounters = this.weightedCounters.get(clusterId);
    
    for (const instance of availableInstances) {
      if (!clusterCounters.has(instance.id)) {
        clusterCounters.set(instance.id, 0);
      }
    }

    let selectedInstance = null;
    let maxScore = -1;

    for (const instance of availableInstances) {
      const currentCount = clusterCounters.get(instance.id) || 0;
      const score = currentCount + instance.weight;

      if (score > maxScore) {
        maxScore = score;
        selectedInstance = instance;
      }
    }

    if (selectedInstance) {
      for (const instance of availableInstances) {
        const currentCount = clusterCounters.get(instance.id) || 0;
        if (instance.id === selectedInstance.id) {
          clusterCounters.set(instance.id, currentCount + selectedInstance.weight - this.getTotalWeight(availableInstances));
        } else {
          clusterCounters.set(instance.id, currentCount + instance.weight);
        }
      }
    }

    return selectedInstance || availableInstances[0];
  }

  getTotalWeight(instances) {
    return instances.reduce((sum, i) => sum + i.weight, 0);
  }

  leastConnections(availableInstances) {
    let minConnections = Infinity;
    let selectedInstance = null;

    for (const instance of availableInstances) {
      if (instance.connections < minConnections) {
        minConnections = instance.connections;
        selectedInstance = instance;
      }
    }

    return selectedInstance || availableInstances[0];
  }

  random(availableInstances) {
    const index = Math.floor(Math.random() * availableInstances.length);
    return availableInstances[index];
  }

  releaseConnection(instanceId) {
    const instance = dataStore.getInstanceById(instanceId);
    if (instance && instance.connections > 0) {
      dataStore.updateInstance(instanceId, {
        connections: instance.connections - 1
      });
    }
  }

  getStats(clusterId) {
    const cluster = dataStore.getClusterById(clusterId);
    if (!cluster) {
      return null;
    }

    const instances = dataStore.getInstancesByClusterId(clusterId);
    const availableInstances = instances.filter(i => i.isAvailable());

    return {
      cluster: cluster.toJSON(),
      strategy: cluster.loadBalancerStrategy,
      totalInstances: instances.length,
      availableInstances: availableInstances.length,
      roundRobinCounter: this.roundRobinCounters.get(clusterId) || 0,
      totalWeight: this.getTotalWeight(availableInstances),
      instances: instances.map(i => ({
        id: i.id,
        name: i.name,
        host: i.host,
        port: i.port,
        role: i.role,
        status: i.status,
        weight: i.weight,
        connections: i.connections,
        weightPercentage: availableInstances.length > 0 
          ? ((i.weight / this.getTotalWeight(availableInstances)) * 100).toFixed(2)
          : 0
      }))
    };
  }
}

module.exports = {
  LoadBalancer: new LoadBalancer(),
  LoadBalancerStrategy
};
