const dataStore = require('./storage/DataStore');
const Cluster = require('./models/Cluster');
const { Instance, InstanceRole, InstanceStatus } = require('./models/Instance');
const { EventLog, EventType, EventSeverity } = require('./models/EventLog');

const seedData = {
  clusters: [
    {
      name: '订单服务集群',
      description: '处理订单创建、支付、查询等核心业务',
      loadBalancerStrategy: 'ROUND_ROBIN',
      healthCheckInterval: 30000,
      instances: [
        { name: 'order-master-01', host: '192.168.1.10', port: 8080, role: 'MASTER', weight: 5, status: 'HEALTHY' },
        { name: 'order-slave-01', host: '192.168.1.11', port: 8080, role: 'SLAVE', weight: 3, status: 'HEALTHY' },
        { name: 'order-slave-02', host: '192.168.1.12', port: 8080, role: 'SLAVE', weight: 3, status: 'HEALTHY' },
        { name: 'order-slave-03', host: '192.168.1.13', port: 8080, role: 'SLAVE', weight: 2, status: 'UNHEALTHY' }
      ]
    },
    {
      name: '用户服务集群',
      description: '用户认证、信息管理、权限控制',
      loadBalancerStrategy: 'WEIGHTED_ROUND_ROBIN',
      healthCheckInterval: 15000,
      instances: [
        { name: 'user-master-01', host: '192.168.2.10', port: 8081, role: 'MASTER', weight: 10, status: 'HEALTHY' },
        { name: 'user-slave-01', host: '192.168.2.11', port: 8081, role: 'SLAVE', weight: 8, status: 'HEALTHY' },
        { name: 'user-slave-02', host: '192.168.2.12', port: 8081, role: 'SLAVE', weight: 5, status: 'HEALTHY' }
      ]
    },
    {
      name: '支付服务集群',
      description: '支付网关、支付回调、交易记录',
      loadBalancerStrategy: 'LEAST_CONNECTIONS',
      healthCheckInterval: 20000,
      instances: [
        { name: 'pay-master-01', host: '192.168.3.10', port: 8082, role: 'MASTER', weight: 5, status: 'HEALTHY' },
        { name: 'pay-slave-01', host: '192.168.3.11', port: 8082, role: 'SLAVE', weight: 5, status: 'DOWN' }
      ]
    }
  ]
};

function loadSeed() {
  for (const clusterData of seedData.clusters) {
    const existingClusters = dataStore.getClusters();
    const exists = existingClusters.some(c => c.name === clusterData.name);
    
    if (exists) {
      console.log(`集群 "${clusterData.name}" 已存在，跳过`);
      continue;
    }
    
    const cluster = new Cluster(
      null,
      clusterData.name,
      clusterData.description,
      clusterData.loadBalancerStrategy,
      clusterData.healthCheckInterval
    );
    
    const createdCluster = dataStore.createCluster(cluster);
    
    dataStore.addEventLog(new EventLog(
      null,
      EventType.CLUSTER_CREATED,
      EventSeverity.INFO,
      createdCluster.id,
      null,
      `集群 ${createdCluster.name} 创建成功 (示例数据)`,
      {
        name: createdCluster.name,
        description: createdCluster.description,
        loadBalancerStrategy: createdCluster.loadBalancerStrategy,
        healthCheckInterval: createdCluster.healthCheckInterval,
        source: 'seed-data'
      }
    ));
    
    for (const instanceData of clusterData.instances) {
      const instance = new Instance(
        null,
        createdCluster.id,
        instanceData.name,
        instanceData.host,
        instanceData.port,
        instanceData.role,
        instanceData.weight,
        instanceData.status
      );
      
      dataStore.createInstance(instance);
      
      dataStore.addEventLog(new EventLog(
        null,
        EventType.INSTANCE_REGISTERED,
        EventSeverity.INFO,
        createdCluster.id,
        instance.id,
        `实例 ${instanceData.name} 注册成功 (示例数据)`,
        {
          name: instanceData.name,
          host: instanceData.host,
          port: instanceData.port,
          role: instanceData.role,
          weight: instanceData.weight,
          status: instanceData.status,
          source: 'seed-data'
        }
      ));
      
      if (instanceData.status === InstanceStatus.UNHEALTHY) {
        dataStore.addEventLog(new EventLog(
          null,
          EventType.HEALTH_CHECK_FAILED,
          EventSeverity.WARNING,
          createdCluster.id,
          instance.id,
          `实例 ${instanceData.name} 健康检查失败`,
          {
            consecutiveFailedChecks: 3,
            maxFailedChecks: 3,
            source: 'seed-data'
          }
        ));
      }
      
      if (instanceData.status === InstanceStatus.DOWN) {
        dataStore.addEventLog(new EventLog(
          null,
          EventType.INSTANCE_EVICTED,
          EventSeverity.ERROR,
          createdCluster.id,
          instance.id,
          `实例 ${instanceData.name} 已被剔除`,
          {
            consecutiveFailedChecks: 5,
            evictionThreshold: 5,
            source: 'seed-data'
          }
        ));
      }
    }
    
    if (clusterData.instances.length === 1) {
      dataStore.addEventLog(new EventLog(
        null,
        EventType.CONFIG_WARNING,
        EventSeverity.WARNING,
        createdCluster.id,
        null,
        `集群 ${createdCluster.name} 只有一个实例，存在单点故障风险！`,
        {
          totalInstances: 1,
          recommendation: '建议增加实例数量以实现高可用',
          source: 'seed-data'
        }
      ));
    }
    
    const unhealthyCount = clusterData.instances.filter(i => 
      i.status === InstanceStatus.UNHEALTHY || i.status === InstanceStatus.DOWN
    ).length;
    
    if (unhealthyCount >= clusterData.instances.length / 2) {
      dataStore.addEventLog(new EventLog(
        null,
        EventType.CONFIG_WARNING,
        EventSeverity.WARNING,
        createdCluster.id,
        null,
        `集群 ${createdCluster.name} 超过半数实例不可用！`,
        {
          totalInstances: clusterData.instances.length,
          unhealthyInstances: unhealthyCount,
          recommendation: '建议检查实例健康状态',
          source: 'seed-data'
        }
      ));
    }
  }
  
  console.log('✅ 示例数据加载完成');
  return true;
}

module.exports = { loadSeed };
