const { initDatabase, run } = require('../src/database');

async function initSampleData() {
  await initDatabase();
  
  console.log('开始初始化样例数据...');

  const sampleTeams = [
    { name: '平台架构组', cpuQuota: 100, storageQuota: 5000 },
    { name: 'AI算法组', cpuQuota: 200, storageQuota: 10000 },
    { name: '业务开发组', cpuQuota: 150, storageQuota: 8000 },
    { name: '数据平台组', cpuQuota: 180, storageQuota: 12000 }
  ];

  for (const team of sampleTeams) {
    try {
      await run(
        'INSERT OR IGNORE INTO teams (name, cpu_quota, storage_quota) VALUES (?, ?, ?)',
        [team.name, team.cpuQuota, team.storageQuota]
      );
      console.log(`已初始化团队: ${team.name}`);
    } catch (e) {
      console.log(`团队 ${team.name} 已存在, 跳过`);
    }
  }

  console.log('样例数据初始化完成!');
  console.log('\n团队配额:');
  sampleTeams.forEach(t => {
    console.log(`  - ${t.name}: CPU=${t.cpuQuota}, STORAGE=${t.storageQuota}`);
  });
}

initSampleData().catch(console.error);
