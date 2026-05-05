const fs = require('fs-extra');
const path = require('path');
const { initDb, createTables, closeDb } = require('../database');

const seedServices = `
- name: user-service
  description: 用户服务
  domain: 用户域
  owner_team: 用户团队

- name: order-service
  description: 订单服务
  domain: 订单域
  owner_team: 订单团队

- name: payment-service
  description: 支付服务
  domain: 支付域
  owner_team: 支付团队

- name: notification-service
  description: 通知服务
  domain: 通知域
  owner_team: 平台团队

- name: product-service
  description: 商品服务
  domain: 商品域
  owner_team: 商品团队
`;

const seedEndpoints = `
- service: user-service
  method: GET
  path: /api/users/{id}
  description: 获取用户信息

- service: user-service
  method: POST
  path: /api/users
  description: 创建用户

- service: order-service
  method: POST
  path: /api/orders
  description: 创建订单

- service: order-service
  method: GET
  path: /api/orders/{id}
  description: 获取订单详情

- service: payment-service
  method: POST
  path: /api/payments
  description: 创建支付

- service: product-service
  method: GET
  path: /api/products/{id}
  description: 获取商品信息
`;

const seedTables = `name,schema_name,owner_service,description,row_count,size_mb,access_services
users,public,user-service,用户主表,100000,50,order-service
user_addresses,public,user-service,用户地址表,80000,20,
orders,public,order-service,订单主表,50000,30,user-service,payment-service
order_items,public,order-service,订单明细表,150000,45,
payments,public,payment-service,支付记录表,48000,25,order-service
products,public,product-service,商品表,10000,15,order-service
product_stock,public,product-service,商品库存表,8000,8,order-service
notifications,public,notification-service,通知记录表,200000,60,
shared_config,public,,共享配置表,100,0.5,user-service,order-service,payment-service
`;

const seedEvents = `{"name":"UserCreated","source_service":"user-service","event_type":"DOMAIN_EVENT","description":"用户创建事件","publishers":[{"service":"user-service","count":100}],"subscribers":[{"service":"notification-service","count":50}]}
{"name":"OrderCreated","source_service":"order-service","event_type":"DOMAIN_EVENT","description":"订单创建事件","publishers":[{"service":"order-service","count":200}],"subscribers":[{"service":"payment-service","count":180}]}
{"name":"PaymentCompleted","source_service":"payment-service","event_type":"DOMAIN_EVENT","description":"支付完成事件","publishers":[{"service":"payment-service","count":150}]}
{"name":"ProductStockUpdated","source_service":"product-service","event_type":"DOMAIN_EVENT","description":"商品库存更新事件"}
`;

const seedCallEdges = `{"source":"order-service","target":"user-service","type":"SYNC","count":1000,"latency_ms":150}
{"source":"order-service","target":"product-service","type":"SYNC","count":800,"latency_ms":120}
{"source":"order-service","target":"payment-service","type":"SYNC","count":500,"latency_ms":200}
{"source":"payment-service","target":"order-service","type":"SYNC","count":300,"latency_ms":100}
{"source":"user-service","target":"order-service","type":"SYNC","count":200,"latency_ms":80}
{"source":"notification-service","target":"user-service","type":"SYNC","count":400,"latency_ms":50}
`;

async function run(options) {
  const targetDir = path.resolve(options.dir);
  const generateSeed = options.seed || false;
  
  console.log(`📦 初始化微服务架构分析项目...`);
  console.log(`   目标目录: ${targetDir}`);
  
  fs.ensureDirSync(targetDir);
  
  const dataDir = path.join(targetDir, 'data');
  const reportsDir = path.join(targetDir, 'reports');
  
  fs.ensureDirSync(dataDir);
  fs.ensureDirSync(reportsDir);
  
  const configPath = path.join(targetDir, 'msa-config.yaml');
  const configContent = `
dataDir: ./data
dbPath: ./msa-db.sqlite
maxSyncChainLength: 3

analysisRules:
  crossServiceTableAccess:
    enabled: true
    severityThreshold:
      multipleServices: 2
      
  circularCalls:
    enabled: true
    
  longSyncChains:
    enabled: true
    maxLength: 3
    
  missingDomainEvents:
    enabled: true
    
  overlappingResponsibilities:
    enabled: true
`;
  fs.writeFileSync(configPath, configContent.trim(), 'utf8');
  console.log(`✓ 已创建配置文件: msa-config.yaml`);
  
  const dbPath = path.join(targetDir, 'msa-db.sqlite');
  await initDb(dbPath);
  createTables();
  closeDb();
  console.log(`✓ 已初始化数据库`);
  
  if (generateSeed) {
    console.log(`\n🌱 生成样例数据...`);
    
    fs.writeFileSync(path.join(dataDir, 'services.yaml'), seedServices.trim(), 'utf8');
    console.log(`  ✓ services.yaml`);
    
    fs.writeFileSync(path.join(dataDir, 'endpoints.yaml'), seedEndpoints.trim(), 'utf8');
    console.log(`  ✓ endpoints.yaml`);
    
    fs.writeFileSync(path.join(dataDir, 'tables.csv'), seedTables.trim(), 'utf8');
    console.log(`  ✓ tables.csv`);
    
    fs.writeFileSync(path.join(dataDir, 'events.jsonl'), seedEvents.trim(), 'utf8');
    console.log(`  ✓ events.jsonl`);
    
    fs.writeFileSync(path.join(dataDir, 'call-edges.jsonl'), seedCallEdges.trim(), 'utf8');
    console.log(`  ✓ call-edges.jsonl`);
  }
  
  const badExamples = `
# ⚠️ 坏样例说明 - 这些是你应该避免的架构模式

## 1. 跨服务直接查表
- 问题: order-service 直接查询 users 表
- 原因: 违反数据边界，紧耦合
- 影响: user-service 表结构变更会影响 order-service
- 正确做法: user-service 提供 GET /api/users/{id} API

## 2. 循环调用
- 问题: A→B→C→A 的同步调用循环
- 原因: 服务职责边界不清
- 影响: 单个服务故障导致整个循环不可用
- 正确做法: 引入消息队列解耦，或合并服务

## 3. 同步链过长
- 问题: 下单时调用链: gateway→order→user→product→payment
- 原因: 过度细粒度的服务拆分
- 影响: 累积延迟高，单点故障影响大
- 正确做法: 使用 BFF 聚合，或异步化非关键路径

## 4. 共享表Owner不清
- 问题: shared_config 表没有明确归属
- 原因: 架构设计遗漏
- 影响: 谁来维护、谁负责数据一致不明确
- 正确做法: 分配给配置中心服务，或拆分为各服务私有配置

## 5. 领域事件缺失
- 问题: payment-service 只被同步调用，从不发布事件
- 原因: 设计时只考虑请求-响应模式
- 影响: 其他服务无法感知支付状态变化
- 正确做法: 发布 PaymentCompleted 事件，订阅方按需处理
`;
  
  fs.writeFileSync(path.join(targetDir, 'BAD-EXAMPLES.md'), badExamples.trim(), 'utf8');
  console.log(`✓ 已创建坏样例说明: BAD-EXAMPLES.md`);
  
  console.log(`\n✅ 初始化完成！`);
  console.log(`\n下一步操作:`);
  console.log(`  1. cd ${targetDir}`);
  console.log(`  2. msa analyze -c msa-config.yaml`);
  console.log(`  3. 查看 reports/ 目录下的分析报告`);
  if (!generateSeed) {
    console.log(`\n提示: 使用 msa init --seed 可以生成样例数据`);
  }
}

module.exports = {
  run,
  seedServices,
  seedEndpoints,
  seedTables,
  seedEvents,
  seedCallEdges
};
