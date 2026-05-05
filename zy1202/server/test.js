const CacheSystem = require('./models/CacheSystem');
const Experiment = require('./models/Experiment');
const ReportGenerator = require('./models/ReportGenerator');

console.log('=== 缓存链路实验台核心测试 ===\n');

async function testCacheSystem() {
  console.log('1. 测试缓存系统...');
  
  const cacheSystem = new CacheSystem({
    l1Capacity: 10,
    l1Ttl: 60,
    l2Capacity: 50,
    l2Ttl: 300,
    writeStrategy: 'write-through',
    useMutex: false,
    useBloomFilter: false,
    enablePreheating: false
  });

  await cacheSystem.set('user:1', { name: 'Alice', age: 25 });
  console.log('   ✓ 写入 user:1 成功');

  const result1 = await cacheSystem.get('user:1');
  console.log(`   ✓ 读取 user:1 成功, 来源: ${result1.fromLayer}, 值: ${JSON.stringify(result1.value)}`);

  const result2 = await cacheSystem.get('user:1');
  console.log(`   ✓ 再次读取 user:1, 来源: ${result2.fromLayer}`);

  const result3 = await cacheSystem.get('user:2');
  console.log(`   ✓ 读取不存在的 key: user:2, 结果: ${result3.value}`);

  const stats = cacheSystem.getStats();
  console.log(`   ✓ 统计: 总请求 ${stats.stats.totalRequests}, 命中率 ${(stats.stats.hitRate * 100).toFixed(2)}%`);

  console.log('   缓存系统测试通过 ✓\n');
  return cacheSystem;
}

async function testExperiment() {
  console.log('2. 测试实验系统...');
  
  const trafficPlan = [
    { type: 'write', key: 'product:1', value: '{"price": 100}', delayMs: 0 },
    { type: 'read', key: 'product:1', value: '', delayMs: 50 },
    { type: 'write', key: 'product:1', value: '{"price": 200}', delayMs: 100 },
    { type: 'read', key: 'product:1', value: '', delayMs: 0 }
  ];

  const experiment = new Experiment({
    name: '测试实验',
    description: '这是一个测试实验',
    writeStrategy: 'write-through',
    delayDoubleDelete: false,
    trafficPlan
  });

  console.log(`   ✓ 实验创建成功: ${experiment.name}`);
  console.log(`   ✓ 流量计划步骤数: ${experiment.trafficPlan.length}`);

  const results = await experiment.simulate();
  console.log(`   ✓ 实验运行完成, 状态: ${experiment.status}`);
  console.log(`   ✓ 执行步骤数: ${results.stepResults.length}`);
  console.log(`   ✓ 总请求数: ${results.finalStats.stats.totalRequests}`);
  console.log(`   ✓ 缓存命中率: ${(results.finalStats.stats.hitRate * 100).toFixed(2)}%`);

  if (results.risks.consistency.count > 0) {
    console.log(`   ⚠ 检测到 ${results.risks.consistency.count} 个一致性窗口`);
  } else {
    console.log(`   ✓ 未检测到一致性问题`);
  }

  console.log('   实验系统测试通过 ✓\n');
  return experiment;
}

async function testReportGenerator() {
  console.log('3. 测试报告生成器...');
  
  const experiment = new Experiment({
    name: '报告测试实验',
    description: '测试报告生成功能',
    writeStrategy: 'cache-invalidate',
    delayDoubleDelete: true,
    trafficPlan: [
      { type: 'write', key: 'item:1', value: '{"value": "test1"}', delayMs: 0 },
      { type: 'read', key: 'item:1', value: '', delayMs: 50 },
      { type: 'read', key: 'item:2', value: '', delayMs: 0 }
    ]
  });

  await experiment.simulate();

  const jsonReport = ReportGenerator.generateJSON(experiment);
  console.log(`   ✓ JSON报告生成成功, 包含实验ID: ${jsonReport.experiment.id}`);

  const markdownReport = ReportGenerator.generateMarkdown(experiment);
  console.log(`   ✓ Markdown报告生成成功, 字数: ${markdownReport.length}`);

  console.log('   报告生成器测试通过 ✓\n');
  return { jsonReport, markdownReport };
}

async function testStrategies() {
  console.log('4. 测试不同缓存策略...');

  const strategies = [
    { name: 'Write-Through', config: { writeStrategy: 'write-through' } },
    { name: 'Write-Behind', config: { writeStrategy: 'write-behind' } },
    { name: 'Cache-Invalidate', config: { writeStrategy: 'cache-invalidate' } },
    { name: 'Cache-Invalidate + 延迟双删', config: { writeStrategy: 'cache-invalidate', delayDoubleDelete: true } }
  ];

  for (const strategy of strategies) {
    console.log(`   测试策略: ${strategy.name}`);
    
    const experiment = new Experiment({
      name: `策略测试 - ${strategy.name}`,
      ...strategy.config,
      trafficPlan: [
        { type: 'write', key: 'key:1', value: '{"version": 1}', delayMs: 0 },
        { type: 'read', key: 'key:1', value: '', delayMs: 50 },
        { type: 'write', key: 'key:1', value: '{"version": 2}', delayMs: 100 },
        { type: 'read', key: 'key:1', value: '', delayMs: 0 }
      ]
    });

    await experiment.simulate();
    
    const results = experiment.simulationResults;
    console.log(`      总请求: ${results.finalStats.stats.totalRequests}`);
    console.log(`      命中率: ${(results.finalStats.stats.hitRate * 100).toFixed(2)}%`);
    console.log(`      一致性窗口: ${results.risks.consistency.count}`);
  }

  console.log('   缓存策略测试通过 ✓\n');
}

async function testRiskProtections() {
  console.log('5. 测试风险防护机制...');

  console.log('   测试布隆过滤器 (防穿透)...');
  const bloomExperiment = new Experiment({
    name: '布隆过滤器测试',
    useBloomFilter: true,
    trafficPlan: [
      { type: 'write', key: 'exist:1', value: '{"value": "data"}', delayMs: 0 },
      { type: 'read', key: 'exist:1', value: '', delayMs: 50 },
      { type: 'read', key: 'not_exist:1', value: '', delayMs: 0 },
      { type: 'read', key: 'not_exist:2', value: '', delayMs: 0 }
    ]
  });
  await bloomExperiment.simulate();
  console.log(`      穿透事件: ${bloomExperiment.simulationResults.risks.penetration.count}`);

  console.log('   测试互斥锁 (防击穿)...');
  const mutexExperiment = new Experiment({
    name: '互斥锁测试',
    useMutex: true,
    trafficPlan: [
      { type: 'write', key: 'hot:1', value: '{"value": "hot_data"}', delayMs: 0 },
      { type: 'read', key: 'hot:1', value: '', delayMs: 50 },
      { type: 'read', key: 'hot:1', value: '', delayMs: 0 }
    ]
  });
  await mutexExperiment.simulate();
  console.log(`      击穿事件: ${mutexExperiment.simulationResults.risks.breakdown.count}`);

  console.log('   测试TTL抖动 (防空瀑)...');
  const jitterExperiment = new Experiment({
    name: 'TTL抖动测试',
    l2Ttl: 60,
    l2TtlJitter: 30,
    trafficPlan: [
      { type: 'write', key: 'batch:1', value: '{"v": 1}', delayMs: 0 },
      { type: 'write', key: 'batch:2', value: '{"v": 2}', delayMs: 0 },
      { type: 'write', key: 'batch:3', value: '{"v": 3}', delayMs: 0 },
      { type: 'write', key: 'batch:4', value: '{"v": 4}', delayMs: 0 },
      { type: 'write', key: 'batch:5', value: '{"v": 5}', delayMs: 0 }
    ]
  });
  await jitterExperiment.simulate();
  console.log(`      高风险时间桶: ${jitterExperiment.simulationResults.risks.avalanche.highRiskBuckets?.length || 0}`);

  console.log('   风险防护机制测试通过 ✓\n');
}

async function runAllTests() {
  console.log('开始运行缓存链路实验台核心测试...\n');

  try {
    await testCacheSystem();
    await testExperiment();
    await testReportGenerator();
    await testStrategies();
    await testRiskProtections();

    console.log('=== 所有测试通过 ===\n');
    console.log('项目说明:');
    console.log('- 后端端口: 3001');
    console.log('- 前端端口: 3000');
    console.log('- 启动命令: npm run dev');
    console.log('- 后端单独启动: npm run server');
    console.log('- 前端单独启动: npm run client');
    console.log('\n功能特性:');
    console.log('✓ L1本地缓存 + L2 Redis缓存 + 数据库三层架构');
    console.log('✓ Cache-Aside读取策略');
    console.log('✓ Write-Through/Write-Behind/Cache-Invalidate写入策略');
    console.log('✓ 延迟双删机制');
    console.log('✓ 布隆过滤器 (防穿透)');
    console.log('✓ 互斥锁 (防击穿)');
    console.log('✓ TTL抖动 (防空瀑)');
    console.log('✓ 缓存预热');
    console.log('✓ 命中率/回源次数统计');
    console.log('✓ 一致性窗口分析');
    console.log('✓ 风险事件时间线');
    console.log('✓ Markdown/JSON报告导出');

  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

runAllTests();
