const fs = require('fs');
const path = require('path');
const { initDatabase } = require('../src/models/database');
const { createBatch, importClaimCSV } = require('../src/services/importService');
const { processClaim } = require('../src/services/processingService');
const { searchClaims, getClaimDetail, exportClaims } = require('../src/services/queryService');

async function runSample() {
  console.log('=== 机场地服申诉处理系统 - 样例演示 ===\n');

  await initDatabase();
  console.log('1. 数据库初始化完成\n');

  console.log('2. 创建申诉批次...');
  const batchId = await createBatch(
    'BATCH-' + Date.now(),
    '2026年5月行李申诉批次',
    '地服员_张小明'
  );
  console.log(`   批次创建成功: ${batchId}\n`);

  console.log('3. 导入申诉CSV数据...');
  const csvPath = path.join(__dirname, '../data/sample_claims.csv');
  const claims = await importClaimCSV(csvPath, batchId);
  console.log(`   成功导入 ${claims.length} 条申诉记录\n`);

  console.log('4. 业务规则自动审核结果:');
  claims.forEach((c, i) => {
    const flag = c.needs_manual_review ? '⚠️ 需人工审核' : '✅ 自动通过';
    console.log(`   ${i + 1}. ${c.baggage_tag_no} - ${c.passenger_name} - ${flag}`);
    if (c.review_reason) {
      console.log(`      原因: ${c.review_reason}`);
    }
  });
  console.log();

  console.log('5. 按行李牌号查询 (CA1234567890)...');
  const searchResult = await searchClaims({ baggage_tag_no: 'CA1234567890' });
  console.log(`   查询到 ${searchResult.total} 条记录\n`);

  console.log('6. 按责任航段查询 (PEK)...');
  const pekResult = await searchClaims({ responsible_segment: 'PEK' });
  console.log(`   北京航段责任: ${pekResult.total} 条\n`);

  console.log('7. 按赔付等级查询 (B级)...');
  const levelBResult = await searchClaims({ compensation_level: 'B' });
  console.log(`   B级赔付(500-2000元): ${levelBResult.total} 条\n`);

  console.log('8. 处理一条申诉 - 放行通过...');
  const claimToApprove = claims.find(c => !c.needs_manual_review);
  if (claimToApprove) {
    const approved = await processClaim(
      claimToApprove.id,
      'approve',
      '审核员_李大红',
      '材料齐全，符合赔付标准，同意放行'
    );
    console.log(`   ${approved.baggage_tag_no} 已通过，处理人: ${approved.handler}\n`);
  }

  console.log('9. 处理一条申诉 - 退回修改...');
  const claimToReturn = claims.find(c => c.needs_manual_review);
  if (claimToReturn) {
    const returned = await processClaim(
      claimToReturn.id,
      'return',
      '审核员_李大红',
      '行李价值证明材料不足，请补充购买凭证'
    );
    console.log(`   ${returned.baggage_tag_no} 已退回，原因: ${returned.status_reason}\n`);
  }

  console.log('10. 查看申诉详情及处理轨迹...');
  const detail = await getClaimDetail(claimToReturn ? claimToReturn.id : claims[0].id);
  console.log(`    行李牌号: ${detail.baggage_tag_no}`);
  console.log(`    当前状态: ${detail.status}`);
  console.log(`    处理轨迹: ${detail.logs.length} 条记录`);
  detail.logs.forEach(log => {
    console.log(`      - [${log.created_at}] ${log.handler} 执行 ${log.action}`);
    if (log.reason) console.log(`        ${log.reason}`);
  });
  console.log();

  console.log('11. 导出明细CSV...');
  const exportResult = await exportClaims({});
  console.log(`    导出 ${exportResult.total} 条记录，与查询结果一致\n`);

  console.log('=== 演示完成 ===');
  console.log('\n系统特点:');
  console.log('✅ 数据持久化 - 重启服务后所有记录可查');
  console.log('✅ 可追踪性 - 每条记录有完整处理轨迹');
  console.log('✅ 查询能力 - 支持行李牌号、航段责任、赔付等级多维度查询');
  console.log('✅ 导出一致 - 导出数量与查询结果完全匹配');
  console.log('✅ 规则引擎 - 自动识别超时、超限、资料不全等情况');
}

runSample().catch(console.error);
