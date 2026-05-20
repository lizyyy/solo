const express = require('express');
const cors = require('cors');
const store = require('./store');
const engine = require('./rules');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.post('/api/services', (req, res) => {
  try {
    const service = store.addService(req.body);
    res.status(201).json(service);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/services', (req, res) => {
  try {
    const services = store.getAllServices(req.query);
    res.json(services);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/services/:id', (req, res) => {
  try {
    const service = store.getService(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    const dependencies = store.getDependenciesByService(req.params.id);
    const timeline = store.getStatusTimelineByService(req.params.id);
    const failures = store.getFailureSamplesByService(req.params.id);
    const checkItems = store.getCheckItemsByService(req.params.id);
    
    res.json({
      service,
      dependencies,
      timeline,
      recentFailures: failures,
      checkItems
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/services/:id/check', async (req, res) => {
  try {
    const result = await engine.runServiceCheck(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/services/:id/report', (req, res) => {
  try {
    const report = engine.generateHealthReport(req.params.id);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/services/:id/report/csv', (req, res) => {
  try {
    const csv = engine.exportReportCSV(req.params.id);
    const service = store.getService(req.params.id);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${service.name}-health-report.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/services/batch-import', (req, res) => {
  try {
    const result = engine.batchImportServices(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/dependencies', (req, res) => {
  try {
    const dependency = store.addDependency(req.body);
    res.status(201).json(dependency);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/dependencies', (req, res) => {
  try {
    const dependencies = store.getAllDependencies();
    res.json(dependencies);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/dependencies/:id/trigger-failure', (req, res) => {
  try {
    const { shouldFail = true } = req.body;
    const dependency = engine.triggerDependencyFailure(req.params.id, shouldFail);
    res.json(dependency);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/dependencies/:id/failures', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const failures = store.getFailureSamplesByDependency(req.params.id, limit);
    res.json(failures);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/services/:id/timeline', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const timeline = store.getStatusTimelineByService(req.params.id, limit);
    res.json(timeline);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/check-items', (req, res) => {
  try {
    const checkItem = store.addCheckItem(req.body);
    res.status(201).json(checkItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/services/:id/check-items', (req, res) => {
  try {
    const checkItems = store.getCheckItemsByService(req.params.id);
    res.json(checkItems);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/dependencies/:id/check-items', (req, res) => {
  try {
    const checkItems = store.getCheckItemsByDependency(req.params.id);
    res.json(checkItems);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/check-items/:id', (req, res) => {
  try {
    const checkItem = store.checkItems.get(req.params.id);
    if (!checkItem) {
      return res.status(404).json({ error: 'Check item not found' });
    }
    Object.assign(checkItem, req.body, { updatedAt: new Date() });
    res.json(checkItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

function initSampleData() {
  store.clear();

  const service1 = store.addService({
    name: '订单服务',
    description: '核心订单处理服务，处理用户下单、支付、发货流程',
    owner: '订单团队',
    tags: ['核心', '交易']
  });

  const dep1_mysql = store.addDependency({
    serviceId: service1.id,
    name: 'MySQL-订单库',
    url: 'mysql://localhost:3306/orders',
    method: 'HEALTH',
    timeout: 3000,
    expectedStatus: 200
  });

  const dep1_redis = store.addDependency({
    serviceId: service1.id,
    name: 'Redis-缓存',
    url: 'redis://localhost:6379',
    method: 'PING',
    timeout: 1000,
    expectedStatus: 200
  });

  const dep1_payment = store.addDependency({
    serviceId: service1.id,
    name: '支付网关',
    url: 'https://api.payment-provider.com/health',
    method: 'GET',
    timeout: 5000,
    expectedStatus: 200
  });

  const dep1_inventory = store.addDependency({
    serviceId: service1.id,
    name: '库存服务',
    url: 'http://inventory-service:8080/health',
    method: 'GET',
    timeout: 3000,
    expectedStatus: 200
  });

  store.addCheckItem({
    serviceId: service1.id,
    dependencyId: dep1_mysql.id,
    type: 'connectivity',
    config: { maxRetries: 3, retryDelay: 1000 }
  });

  store.addCheckItem({
    serviceId: service1.id,
    dependencyId: dep1_redis.id,
    type: 'latency',
    config: { thresholdMs: 100 }
  });

  store.addCheckItem({
    serviceId: service1.id,
    dependencyId: dep1_payment.id,
    type: 'response_schema',
    config: { expectedFields: ['status', 'timestamp'] }
  });

  const service2 = store.addService({
    name: '用户服务',
    description: '用户信息管理、认证、权限控制服务',
    owner: '用户团队',
    tags: ['核心', '认证']
  });

  store.updateService(service2.id, { status: 'degraded', healthScore: 75 });

  const dep2_mysql = store.addDependency({
    serviceId: service2.id,
    name: 'MySQL-用户库',
    url: 'mysql://localhost:3306/users',
    method: 'HEALTH',
    timeout: 3000,
    expectedStatus: 200
  });

  dep2_mysql.status = 'degraded';
  dep2_mysql.consecutiveFailures = 2;
  dep2_mysql.consecutiveSuccesses = 0;
  dep2_mysql.lastFailureAt = new Date();

  const dep2_redis = store.addDependency({
    serviceId: service2.id,
    name: 'Redis-Session',
    url: 'redis://localhost:6380',
    method: 'PING',
    timeout: 1000,
    expectedStatus: 200
  });

  dep2_redis.status = 'up';
  dep2_redis.consecutiveSuccesses = 15;
  dep2_redis.lastSuccessAt = new Date();

  store.addCheckItem({
    serviceId: service2.id,
    dependencyId: dep2_mysql.id,
    type: 'connection_pool',
    config: { minConnections: 10, maxConnections: 100 }
  });

  store.addCheckItem({
    serviceId: service2.id,
    dependencyId: dep2_redis.id,
    type: 'memory_usage',
    config: { maxMemoryPercent: 80 }
  });

  store.addFailureSample({
    serviceId: service2.id,
    dependencyId: dep2_mysql.id,
    errorMessage: 'MySQL Connection Timeout - 连接池耗尽',
    statusCode: 504,
    responseTime: 5200,
    requestDetails: { query: 'SELECT * FROM users WHERE id = ?' }
  });

  store.addFailureSample({
    serviceId: service2.id,
    dependencyId: dep2_mysql.id,
    errorMessage: 'MySQL Lock Wait Timeout Exceeded',
    statusCode: 500,
    responseTime: 8100,
    requestDetails: { query: 'UPDATE users SET last_login = NOW()' }
  });

  store.addStatusTimeline({
    serviceId: service2.id,
    oldStatus: 'healthy',
    newStatus: 'degraded',
    reason: 'MySQL 连接池耗尽，连续失败 2 次，服务降级运行',
    metadata: { failedCount: 1, totalDependencies: 2, healthScore: 75 }
  });

  service2.degradedSince = new Date(Date.now() - 3600000);
  service2.lastCheckAt = new Date();

  const service3 = store.addService({
    name: '商品服务',
    description: '商品信息、库存、价格管理',
    owner: '商品团队',
    tags: ['商品', '基础']
  });

  store.updateService(service3.id, { status: 'unhealthy', healthScore: 25 });

  const dep3_pg = store.addDependency({
    serviceId: service3.id,
    name: 'PostgreSQL-商品库',
    url: 'postgresql://localhost:5432/products',
    method: 'HEALTH',
    timeout: 3000,
    expectedStatus: 200
  });

  dep3_pg.status = 'down';
  dep3_pg.consecutiveFailures = 8;
  dep3_pg.consecutiveSuccesses = 0;
  dep3_pg.lastFailureAt = new Date();

  const dep3_es = store.addDependency({
    serviceId: service3.id,
    name: 'Elasticsearch-商品搜索',
    url: 'http://localhost:9200/_cluster/health',
    method: 'GET',
    timeout: 5000,
    expectedStatus: 200
  });

  dep3_es.status = 'down';
  dep3_es.consecutiveFailures = 5;
  dep3_es.consecutiveSuccesses = 0;
  dep3_es.lastFailureAt = new Date();
  dep3_es._forceFail = true;

  store.addCheckItem({
    serviceId: service3.id,
    dependencyId: dep3_pg.id,
    type: 'replication_lag',
    config: { maxLagSeconds: 10 }
  });

  store.addCheckItem({
    serviceId: service3.id,
    dependencyId: dep3_es.id,
    type: 'cluster_health',
    config: { minGreenNodes: 3 }
  });

  for (let i = 0; i < 8; i++) {
    store.addFailureSample({
      serviceId: service3.id,
      dependencyId: dep3_pg.id,
      errorMessage: ['PostgreSQL Connection Refused', 'Database Out of Memory', 'Read Replica Sync Failed'][i % 3],
      statusCode: [503, 500, 504][i % 3],
      responseTime: 1000 + i * 500,
      requestDetails: { attempt: i + 1 }
    });
  }

  for (let i = 0; i < 5; i++) {
    store.addFailureSample({
      serviceId: service3.id,
      dependencyId: dep3_es.id,
      errorMessage: 'Elasticsearch Cluster Unavailable - No Shards Allocated',
      statusCode: 503,
      responseTime: 6000,
      requestDetails: { index: 'products_v2' }
    });
  }

  store.addStatusTimeline({
    serviceId: service3.id,
    oldStatus: 'healthy',
    newStatus: 'degraded',
    reason: 'PostgreSQL 出现连接异常，连续失败 2 次',
    metadata: { failedCount: 1, totalDependencies: 2, healthScore: 50 }
  });

  store.addStatusTimeline({
    serviceId: service3.id,
    oldStatus: 'degraded',
    newStatus: 'unhealthy',
    reason: 'PostgreSQL 和 Elasticsearch 均处于 DOWN 状态，服务完全不可用',
    metadata: { failedCount: 2, totalDependencies: 2, healthScore: 25 }
  });

  service3.degradedSince = new Date(Date.now() - 7200000);
  service3.lastCheckAt = new Date();

  const service4 = store.addService({
    name: '营销活动服务',
    description: '营销活动配置、优惠券发放、活动规则引擎（看似正常但有隐患）',
    owner: '营销团队',
    tags: ['营销', '活动']
  });

  const dep4_main = store.addDependency({
    serviceId: service4.id,
    name: 'MySQL-活动库',
    url: 'mysql://localhost:3306/campaigns',
    method: 'HEALTH',
    timeout: 3000,
    expectedStatus: 200
  });

  dep4_main.status = 'up';
  dep4_main.consecutiveSuccesses = 100;
  dep4_main.lastSuccessAt = new Date();

  const dep4_coupon = store.addDependency({
    serviceId: service4.id,
    name: '优惠券发放接口',
    url: 'http://coupon-service:8080/health',
    method: 'GET',
    timeout: 5000,
    expectedStatus: 200
  });

  dep4_coupon.status = 'up';
  dep4_coupon.consecutiveSuccesses = 45;
  dep4_coupon.consecutiveFailures = 0;
  dep4_coupon.lastSuccessAt = new Date();
  dep4_coupon._forceFail = true;
  dep4_coupon._hiddenFailure = true;

  const dep4_sms = store.addDependency({
    serviceId: service4.id,
    name: '短信通知服务',
    url: 'https://sms-provider.com/health',
    method: 'GET',
    timeout: 3000,
    expectedStatus: 200
  });

  dep4_sms.status = 'up';
  dep4_sms.consecutiveSuccesses = 200;
  dep4_sms.lastSuccessAt = new Date();

  store.addCheckItem({
    serviceId: service4.id,
    dependencyId: dep4_main.id,
    type: 'table_lock',
    config: { maxLockWaitMs: 1000 }
  });

  store.addCheckItem({
    serviceId: service4.id,
    dependencyId: dep4_coupon.id,
    type: 'error_rate',
    config: { maxErrorRate: 0.05 },
    enabled: false
  });

  store.addCheckItem({
    serviceId: service4.id,
    dependencyId: dep4_sms.id,
    type: 'throughput',
    config: { minTps: 100 }
  });

  store.addFailureSample({
    serviceId: service4.id,
    dependencyId: dep4_coupon.id,
    errorMessage: '优惠券发放接口返回 200 但实际发券失败 - 库存不足',
    statusCode: 200,
    responseTime: 150,
    requestDetails: { 
      note: '接口返回成功但业务逻辑失败，健康检查未检测到',
      couponId: 'SUMMER2024',
      actualResult: 'NO_STOCK'
    }
  });

  const service5 = store.addService({
    name: '日志分析服务',
    description: '日志收集、存储、检索、可视化分析',
    owner: '基础设施团队',
    tags: ['基础设施', '日志']
  });

  store.updateService(service5.id, { status: 'recovering', healthScore: 60 });

  const dep5_es = store.addDependency({
    serviceId: service5.id,
    name: 'Elasticsearch-日志集群',
    url: 'http://localhost:9201/_cluster/health',
    method: 'GET',
    timeout: 5000,
    expectedStatus: 200
  });

  dep5_es.status = 'up';
  dep5_es.consecutiveSuccesses = 2;
  dep5_es.consecutiveFailures = 0;
  dep5_es.lastSuccessAt = new Date();

  const dep5_kafka = store.addDependency({
    serviceId: service5.id,
    name: 'Kafka-日志队列',
    url: 'kafka://localhost:9092',
    method: 'HEALTH',
    timeout: 3000,
    expectedStatus: 200
  });

  dep5_kafka.status = 'up';
  dep5_kafka.consecutiveSuccesses = 3;
  dep5_kafka.consecutiveFailures = 0;
  dep5_kafka.lastSuccessAt = new Date();

  store.addCheckItem({
    serviceId: service5.id,
    dependencyId: dep5_es.id,
    type: 'indexing_latency',
    config: { maxLatencyMs: 5000 }
  });

  store.addStatusTimeline({
    serviceId: service5.id,
    oldStatus: 'healthy',
    newStatus: 'unhealthy',
    reason: 'Kafka 和 Elasticsearch 同时故障，日志系统中断',
    metadata: { failedCount: 2, totalDependencies: 2, healthScore: 0 }
  });

  store.addStatusTimeline({
    serviceId: service5.id,
    oldStatus: 'unhealthy',
    newStatus: 'recovering',
    reason: 'Kafka 已恢复，Elasticsearch 连续成功 2 次，服务恢复中',
    metadata: { failedCount: 0, totalDependencies: 2, healthScore: 60 }
  });

  service5.degradedSince = new Date(Date.now() - 86400000);
  service5.recoveredAt = null;
  service5.lastCheckAt = new Date();

  console.log('Sample data initialized: 5 services, 14 dependencies, 10 check items, 20 failure samples, 6 timeline entries');
  console.log('- 订单服务: healthy (正常流)');
  console.log('- 用户服务: degraded (降级流)');
  console.log('- 商品服务: unhealthy (异常流)');
  console.log('- 营销活动服务: healthy (看似正常但有隐患 - 核心场景)');
  console.log('- 日志分析服务: recovering (恢复中)');
}

app.listen(PORT, () => {
  console.log(`Dependency Health Checker Backend running on port ${PORT}`);
  initSampleData();
});
