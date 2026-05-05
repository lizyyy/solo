const dataStore = require('../storage/DataStore');
const { Instance, InstanceRole, InstanceStatus } = require('../models/Instance');
const { EventLog, EventType, EventSeverity } = require('../models/EventLog');

class ServiceDiscovery {
  constructor() {
    this.healthCheckIntervals = new Map();
  }

  registerInstance(clusterId, name, host, port, role = InstanceRole.SLAVE, weight = 1) {
    const cluster = dataStore.getClusterById(clusterId);
    if (!cluster) {
      throw new Error(`集群不存在: ${clusterId}`);
    }

    const existingInstances = dataStore.getInstancesByClusterId(clusterId);
    
    const hasMaster = existingInstances.some(i => i.isMaster());
    
    let finalRole = role;
    if (!hasMaster && role === InstanceRole.SLAVE) {
      finalRole = InstanceRole.MASTER;
      
      dataStore.addEventLog(new EventLog(
        null,
        EventType.MASTER_ELECTION,
        EventSeverity.INFO,
        clusterId,
        null,
        `集群 ${cluster.name} 没有主节点，新实例自动提升为主节点`,
        { instanceName: name, host, port }
      ));
    }

    const instance = new Instance(
      null,
      clusterId,
      name,
      host,
      port,
      finalRole,
      weight
    );

    const validation = instance.validate();
    if (!validation.isValid) {
      throw new Error(validation.errors.join('; '));
    }

    const createdInstance = dataStore.createInstance(instance);

    dataStore.addEventLog(new EventLog(
      null,
      EventType.INSTANCE_REGISTERED,
      EventSeverity.INFO,
      clusterId,
      createdInstance.id,
      `实例 ${name} 注册成功`,
      { 
        host, 
        port, 
        role: finalRole,
        weight,
        isMaster: finalRole === InstanceRole.MASTER
      }
    ));

    this.checkConfigurationWarnings(clusterId);

    return createdInstance;
  }

  deregisterInstance(instanceId) {
    const instance = dataStore.getInstanceById(instanceId);
    if (!instance) {
      throw new Error(`实例不存在: ${instanceId}`);
    }

    const cluster = dataStore.getClusterById(instance.clusterId);
    const wasMaster = instance.isMaster();

    dataStore.addEventLog(new EventLog(
      null,
      EventType.INSTANCE_DEREGISTERED,
      EventSeverity.INFO,
      instance.clusterId,
      instanceId,
      `实例 ${instance.name} 注销`,
      { 
        host: instance.host, 
        port: instance.port,
        wasMaster,
        reason: '手动注销'
      }
    ));

    dataStore.deleteInstance(instanceId);

    if (wasMaster) {
      this.triggerFailover(instance.clusterId);
    }

    return true;
  }

  getAvailableInstances(clusterId) {
    const instances = dataStore.getInstancesByClusterId(clusterId);
    return instances.filter(i => i.isAvailable());
  }

  getMasterInstance(clusterId) {
    const instances = dataStore.getInstancesByClusterId(clusterId);
    return instances.find(i => i.isMaster());
  }

  checkConfigurationWarnings(clusterId) {
    const instances = dataStore.getInstancesByClusterId(clusterId);
    const cluster = dataStore.getClusterById(clusterId);

    const healthyCount = instances.filter(i => i.isAvailable()).length;
    const totalCount = instances.length;
    const hasMaster = instances.some(i => i.isMaster());

    if (totalCount > 0 && !hasMaster) {
      dataStore.addEventLog(new EventLog(
        null,
        EventType.CONFIG_WARNING,
        EventSeverity.WARNING,
        clusterId,
        null,
        `集群 ${cluster?.name || clusterId} 没有主节点！`,
        {
          totalInstances: totalCount,
          healthyInstances: healthyCount,
          recommendation: '请执行主节点选举'
        }
      ));
    }

    if (totalCount > 0 && healthyCount < totalCount / 2) {
      dataStore.addEventLog(new EventLog(
        null,
        EventType.CONFIG_WARNING,
        EventSeverity.WARNING,
        clusterId,
        null,
        `集群 ${cluster?.name || clusterId} 超过半数实例不可用！`,
        {
          totalInstances: totalCount,
          healthyInstances: healthyCount,
          recommendation: '建议检查实例健康状态'
        }
      ));
    }

    if (totalCount === 1) {
      dataStore.addEventLog(new EventLog(
        null,
        EventType.CONFIG_WARNING,
        EventSeverity.WARNING,
        clusterId,
        null,
        `集群 ${cluster?.name || clusterId} 只有一个实例，存在单点故障风险！`,
        {
          totalInstances: totalCount,
          recommendation: '建议增加实例数量以实现高可用'
        }
      ));
    }
  }

  triggerFailover(clusterId) {
    const instances = dataStore.getInstancesByClusterId(clusterId);
    const availableInstances = instances.filter(i => i.isAvailable() && !i.isMaster());

    if (availableInstances.length === 0) {
      dataStore.addEventLog(new EventLog(
        null,
        EventType.MASTER_FAILOVER,
        EventSeverity.CRITICAL,
        clusterId,
        null,
        '故障转移失败：没有可用的从节点可以提升为主节点',
        {
          totalInstances: instances.length,
          availableInstances: 0
        }
      ));
      throw new Error('没有可用的从节点进行故障转移');
    }

    let newMaster;
    
    availableInstances.sort((a, b) => {
      if (a.weight !== b.weight) {
        return b.weight - a.weight;
      }
      return a.registeredAt - b.registeredAt;
    });

    newMaster = availableInstances[0];

    dataStore.updateInstance(newMaster.id, {
      role: InstanceRole.MASTER,
      lastStatusChangeTime: Date.now()
    });

    dataStore.addEventLog(new EventLog(
      null,
      EventType.MASTER_FAILOVER,
      EventSeverity.CRITICAL,
      clusterId,
      newMaster.id,
      `故障转移成功：实例 ${newMaster.name} 已提升为主节点`,
      {
        oldMaster: '原主节点故障',
        newMaster: newMaster.name,
        newMasterHost: newMaster.host,
        newMasterPort: newMaster.port,
        selectionCriteria: [
          '1. 优先选择权重高的实例',
          '2. 权重相同则选择注册时间较早的实例'
        ]
      }
    ));

    this.checkConfigurationWarnings(clusterId);

    return dataStore.getInstanceById(newMaster.id);
  }

  electMaster(clusterId) {
    return this.triggerFailover(clusterId);
  }

  getClusterStatus(clusterId) {
    const cluster = dataStore.getClusterById(clusterId);
    if (!cluster) {
      return null;
    }

    const instances = dataStore.getInstancesByClusterId(clusterId);
    const master = this.getMasterInstance(clusterId);
    const availableInstances = this.getAvailableInstances(clusterId);

    return {
      cluster: cluster.toJSON(),
      summary: {
        totalInstances: instances.length,
        availableInstances: availableInstances.length,
        hasMaster: !!master,
        masterName: master?.name || null,
        masterId: master?.id || null,
        strategy: cluster.loadBalancerStrategy
      },
      instances: instances.map(i => i.toJSON())
    };
  }
}

module.exports = new ServiceDiscovery();
