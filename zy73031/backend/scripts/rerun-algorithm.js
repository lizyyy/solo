const initDatabase = require('./init-db');
const { runDetection } = require('../services/anomaly-detector');

async function main() {
  await initDatabase();
  console.log('========================================');
  console.log('  宠物训练课异常提醒 - 算法重跑入口');
  console.log('========================================');
  console.log(`开始时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('');

  const result = await runDetection(true);

  console.log(`算法版本:   ${result.algorithm_version}`);
  console.log(`口径版本:   ${result.caliber_version}`);
  console.log(`发现异常数: ${result.count}`);
  console.log('');
  console.log('异常类型分布:');
  const typeMap = {};
  for (const a of result.alerts) {
    typeMap[a.anomaly_type] = (typeMap[a.anomaly_type] || 0) + 1;
  }
  for (const [t, c] of Object.entries(typeMap)) {
    console.log(`  - ${t}: ${c}条`);
  }
  console.log('');
  console.log(`完成时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('========================================');
}

main().catch(e => { console.error(e); process.exit(1); });
