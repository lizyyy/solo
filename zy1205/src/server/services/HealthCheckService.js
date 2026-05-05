const dataStore = require('../storage/DataStore');
const { InstanceStatus } = require('../models/Instance');
const { EventLog, EventType, EventSeverity } = require('../models/EventLog');
const serviceDiscovery = require('./ServiceDiscovery');

const MAX_FAILED_CHECKS = 3;
const EVICTION_THRESHOLD = 5;

class HealthCheckService {
  constructor() {
    this.intervals = new Map();
  }

  startHealthCheck(clusterId, interval) {
    this.stopHealthCheck(clusterId);
    
    const intervalId = setInterval(() => {
      this.performHealthCheck(clusterId);
    }, interval);
    
    this.intervals.set(clusterId, intervalId);
  }

  stopHealthCheck(clusterId) {
    const intervalId = this.intervals.get(clusterId);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(clusterId);
    }
  }

  performHealthCheck(clusterId) {
    const instances = dataStore.getInstancesByClusterId(clusterId);
    const cluster = dataStore.getClusterById(clusterId);

    for (const instance of instances) {
      this.checkInstanceHealth(instance, cluster);
    }
  }

  checkInstanceHealth(instance, cluster) {
    const isHealthy = this.simulateHealthCheck(instance);
    
    dataStore.updateInstance(instance.id, {
      lastHealthCheckTime: Date.now()
    });

    if (isHealthy) {
      this.handleHealthyInstance(instance, cluster);
    } else {
      this.handleUnhealthyInstance(instance, cluster);
    }
  }

  simulateHealthCheck(instance) {
    if (instance.status === InstanceStatus.DOWN) {
      return false;
    }
    if (instance.status === InstanceStatus.MAINTENANCE) {
      return false;
    }
    
    return instance.status === InstanceStatus.HEALTHY;
  }

  handleHealthyInstance(instance, cluster) {
    const updatedInstance = dataStore.updateInstance(instance.id, {
      failedHealthChecks: 0
    });

    if (instance.status === InstanceStatus.UNHEALTHY) {
      dataStore.updateInstance(instance.id, {
        status: InstanceStatus.HEALTHY,
        lastStatusChangeTime: Date.now()
      });

      dataStore.addEventLog(new EventLog(
        null,
        EventType.INSTANCE_RESTORED,
        EventSeverity.INFO,
        cluster.id,
        instance.id,
        `实例 ${instance.name} 恢复健康`,
        {
          host: instance.host,
          port: instance.port,
          previousStatus: instance.status,
          newStatus: InstanceStatus.HEALTHY
        }
      ));
    }

    dataStore.addEventLog(new EventLog(
      null,
      EventType.HEALTH_CHECK_PASSED,
      EventSeverity.INFO,
      cluster.id,
      instance.id,
      `实例 ${instance.name} 健康检查通过`,
      {
        host: instance.host,
        port: instance.port,
        consecutiveFailedChecks: 0
      }
    ));
  }

  handleUnhealthyInstance(instance, cluster) {
    const newFailedCount = (instance.failedHealthChecks || 0) + 1;
    
    dataStore.updateInstance(instance.id, {
      failedHealthChecks: newFailedCount
    });

    dataStore.addEventLog(new EventLog(
      null,
      EventType.HEALTH_CHECK_FAILED,
      EventSeverity.WARNING,
      cluster.id,
      instance.id,
      `实例 ${instance.name} 健康检查失败`,
      {
        host: instance.host,
        port: instance.port,
        consecutiveFailedChecks: newFailedCount,
        maxFailedChecks: MAX_FAILED_CHECKS,
        evictionThreshold: EVICTION_THRESHOLD
      }
    ));

    if (newFailedCount >= MAX_FAILED_CHECKS && instance.status === InstanceStatus.HEALTHY) {
      dataStore.updateInstance(instance.id, {
        status: InstanceStatus.UNHEALTHY,
        lastStatusChangeTime: Date.now()
      });

      dataStore.addEventLog(new EventLog(
        null,
        EventType.INSTANCE_STATUS_CHANGED,
        EventSeverity.WARNING,
        cluster.id,
        instance.id,
        `实例 ${instance.name} 状态变更为不健康`,
        {
          host: instance.host,
          port: instance.port,
          previousStatus: InstanceStatus.HEALTHY,
          newStatus: InstanceStatus.UNHEALTHY,
          reason: `连续 ${MAX_FAILED_CHECKS} 次健康检查失败`
        }
      ));

      if (instance.isMaster()) {
        this.handleMasterFailure(instance, cluster);
      }
    }

    if (newFailedCount >= EVICTION_THRESHOLD && instance.status !== InstanceStatus.DOWN) {
      this.evictInstance(instance, cluster);
    }
  }

  handleMasterFailure(instance, cluster) {
    dataStore.addEventLog(new EventLog(
      null,
      EventType.MASTER_FAILOVER,
      EventSeverity.CRITICAL,
      cluster.id,
      instance.id,
      `主节点 ${instance.name} 故障，即将进行故障转移`,
      {
        host: instance.host,
        port: instance.port,
        status: instance.status,
        failedChecks: instance.failedHealthChecks
      }
    ));

    try {
      serviceDiscovery.triggerFailover(cluster.id);
    } catch (error) {
      dataStore.addEventLog(new EventLog(
        null,
        EventType.MASTER_FAILOVER,
        EventSeverity.CRITICAL,
        cluster.id,
        null,
        `故障转移失败: ${error.message}`,
        {
          error: error.message,
          recommendation: '请检查可用的从节点'
        }
      ));
    }
  }

  evictInstance(instance, cluster) {
    dataStore.updateInstance(instance.id, {
      status: InstanceStatus.DOWN,
      lastStatusChangeTime: Date.now()
    });

    dataStore.addEventLog(new EventLog(
      null,
      EventType.INSTANCE_EVICTED,
      EventSeverity.ERROR,
      cluster.id,
      instance.id,
      `实例 ${instance.name} 已被剔除`,
      {
        host: instance.host,
        port: instance.port,
        previousStatus: instance.status,
        newStatus: InstanceStatus.DOWN,
        reason: `连续 ${instance.failedHealthChecks || EVICTION_THRESHOLD} 次健康检查失败，超过剔除阈值`,
        evictionThreshold: EVICTION_THRESHOLD
      }
    ));

    if (instance.isMaster()) {
      this.handleMasterFailure(instance, cluster);
    }
  }

  manualSetInstanceDown(instanceId, reason) {
    const instance = dataStore.getInstanceById(instanceId);
    if (!instance) {
      throw new Error(`实例不存在: ${instanceId}`);
    }

    const cluster = dataStore.getClusterById(instance.clusterId);
    const wasMaster = instance.isMaster();

    dataStore.updateInstance(instanceId, {
      status: InstanceStatus.DOWN,
      lastStatusChangeTime: Date.now()
    });

    dataStore.addEventLog(new EventLog(
      null,
      EventType.MANUAL_OPERATION,
      EventSeverity.WARNING,
      instance.clusterId,
      instanceId,
      `手动将实例 ${instance.name} 标记为宕机`,
      {
        host: instance.host,
        port: instance.port,
        previousStatus: instance.status,
        newStatus: InstanceStatus.DOWN,
        reason: reason || '手动操作',
        wasMaster
      }
    ));

    if (wasMaster) {
      try {
        serviceDiscovery.triggerFailover(instance.clusterId);
      } catch (error) {
        dataStore.addEventLog(new EventLog(
          null,
          EventType.MASTER_FAILOVER,
          EventSeverity.CRITICAL,
          instance.clusterId,
          null,
          `故障转移失败: ${error.message}`,
          {
            error: error.message,
            recommendation: '请检查可用的从节点'
          }
        ));
      }
    }

    return dataStore.getInstanceById(instanceId);
  }

  manualRecoverInstance(instanceId) {
    const instance = dataStore.getInstanceById(instanceId);
    if (!instance) {
      throw new Error(`实例不存在: ${instanceId}`);
    }

    const cluster = dataStore.getClusterById(instance.clusterId);
    const wasDown = instance.status === InstanceStatus.DOWN || instance.status === InstanceStatus.UNHEALTHY;

    if (instance.status === InstanceStatus.HEALTHY) {
      return instance;
    }

    dataStore.updateInstance(instanceId, {
      status: InstanceStatus.HEALTHY,
      failedHealthChecks: 0,
      lastStatusChangeTime: Date.now()
    });

    dataStore.addEventLog(new EventLog(
      null,
      EventType.MANUAL_OPERATION,
      EventSeverity.INFO,
      instance.clusterId,
      instanceId,
      `手动恢复实例 ${instance.name}`,
      {
        host: instance.host,
        port: instance.port,
        previousStatus: instance.status,
        newStatus: InstanceStatus.HEALTHY,
        reason: '手动恢复'
      }
    ));

    if (wasDown) {
      serviceDiscovery.checkConfigurationWarnings(instance.clusterId);
    }

    return dataStore.getInstanceById(instanceId);
  }

  updateInstanceWeight(instanceId, newWeight) {
    const instance = dataStore.getInstanceById(instanceId);
    if (!instance) {
      throw new Error(`实例不存在: ${instanceId}`);
    }

    const cluster = dataStore.getClusterById(instance.clusterId);

    if (newWeight < 1 || newWeight > 100) {
      throw new Error('权重应在1-100之间');
    }

    const oldWeight = instance.weight;

    dataStore.updateInstance(instanceId, {
      weight: newWeight
    });

    dataStore.addEventLog(new EventLog(
      null,
      EventType.INSTANCE_WEIGHT_CHANGED,
      EventSeverity.INFO,
      instance.clusterId,
      instanceId,
      `实例 ${instance.name} 权重调整`,
      {
        host: instance.host,
        port: instance.port,
        oldWeight,
        newWeight,
        impact: '权重越高，在加权轮询算法中被选中的概率越大'
      }
    ));

    return dataStore.getInstanceById(instanceId);
  }

  getAllHealthCheckStats(clusterId) {
    const instances = dataStore.getInstancesByClusterId(clusterId);
    
    return {
      total: instances.length,
      healthy: instances.filter(i => i.status === InstanceStatus.HEALTHY).length,
      unhealthy: instances.filter(i => i.status === InstanceStatus.UNHEALTHY).length,
      down: instances.filter(i => i.status === InstanceStatus.DOWN).length,
      maintenance: instances.filter(i => i.status === InstanceStatus.MAINTENANCE).length,
      instances: instances.map(i => ({
        id: i.id,
        name: i.name,
        host: i.host,
        port: i.port,
        role: i.role,
        status: i.status,
        weight: i.weight,
        connections: i.connections,
        lastHealthCheckTime: i.lastHealthCheckTime,
        failedHealthChecks: i.failedHealthChecks
      }))
    };
  }
}

module.exports = new HealthCheckService();
