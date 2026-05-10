const { ensureDbReady, closeDb } = require('./connection');

async function main() {
  console.log('初始化母乳库数据库...');

  await ensureDbReady();

  console.log('✓ 数据库初始化完成');
  console.log('  - donations: 捐赠记录表');
  console.log('  - test_results: 检测结果表');
  console.log('  - frozen_batches: 冻存批次表');
  console.log('  - distribution_records: 发放记录表');
  console.log('  - recall_records: 召回记录表');
  console.log('  - idempotent_requests: 幂等请求表');

  await closeDb();
}

main().catch(console.error);
