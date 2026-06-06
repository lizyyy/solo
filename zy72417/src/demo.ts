import workflowEngine from './services/workflowEngine';
import importEngine from './services/importEngine';
import selfCheckEngine from './services/selfCheckEngine';
import dataSource from './services/dataSource';
import exportService from './services/exportService';
import { ProcessingStatus } from './types';

async function runDemo() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          校园乐队器材维修 - 版权运营管理系统 演示              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`数据源实例ID: ${dataSource.getInstanceId()}`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【第一步】授权期限页第一次导入');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const sampleData = importEngine.generateSampleImportData();
  console.log(`准备导入 ${sampleData.length} 条示例数据`);
  console.log('  → 注意: 第3条数据"夜行者"乐队授权地区只写了"江苏", 缺少具体城市');
  console.log('');

  const step1Result = await workflowEngine.executeStep1_Import('版权运营小鹿', sampleData);
  console.log(`导入结果: ${step1Result.message}`);
  console.log('');

  const terms = dataSource.getAuthorizationTerms();
  terms.forEach(t => {
    const citiesText = t.authorizedCities.map(c => `${c.province}${c.city}`).join(', ');
    const statusIcon = t.status === ProcessingStatus.VERIFICATION_REQUIRED ? '⚠️' : '✅';
    console.log(`  ${statusIcon} 行${t.originalRowNumber}: ${t.bandName} - 授权地区: [${t.originalAuthorizedCitiesText}] → 解析为 [${citiesText}] (状态: ${t.status})`);
  });
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【自检】执行四大自检项');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const checkResults = selfCheckEngine.runAllChecks('系统自检');
  checkResults.forEach(r => {
    const icon = r.result === 'pass' ? '✅' : r.result === 'warning' ? '⚠️' : '❌';
    console.log(`  ${icon} ${r.checkName}: ${r.description}`);
  });
  console.log('');

  const pendingReview = terms.filter(t => t.status === ProcessingStatus.VERIFICATION_REQUIRED);
  console.log(`发现 ${pendingReview.length} 条记录待店长复核（授权地区可能少写了城市）`);
  pendingReview.forEach(t => {
    console.log(`  → 行${t.originalRowNumber}: ${t.bandName} - 原始文本:"${t.originalAuthorizedCitiesText}", 解析出${t.authorizedCities.length}个城市`);
  });
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【第二步】版权运营小鹿补看调音师留言');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const normalTerms = terms.filter(t => t.status !== ProcessingStatus.VERIFICATION_REQUIRED);
  for (const term of normalTerms) {
    const result = await workflowEngine.executeStep2_TunerReview(
      term.id,
      '版权运营小鹿',
      `${term.equipmentType}检查正常，拾音器状态良好，建议每3个月校准一次。`,
      '张调音师'
    );
    console.log(`  ${term.bandName}: ${result.message}`);
  }
  console.log('');

  const pendingTerm = pendingReview[0];
  if (pendingTerm) {
    const result = await workflowEngine.executeStep2_TunerReview(
      pendingTerm.id,
      '版权运营小鹿'
    );
    console.log(`  ${pendingTerm.bandName}: ${result.message}`);
  }
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【店长复核】授权地区少写城市的记录, 留给店长确认');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (pendingTerm) {
    console.log(`  店长正在复核 "${pendingTerm.bandName}" 的授权地区...`);
    console.log(`  原始文本: "${pendingTerm.originalAuthorizedCitiesText}"`);
    console.log(`  店长补充: 应为"江苏-南京"`);
    console.log('');

    const reviewResult = await workflowEngine.managerReview(
      pendingTerm.id,
      '店长',
      true,
      '确认授权地区为江苏南京，补充完整'
    );
    console.log(`  复核结果: ${reviewResult.message}`);
  }
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【第三步】课时核销单更新');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const reviewedTerms = dataSource.getAuthorizationTerms().filter(
    t => t.status === ProcessingStatus.TUNER_REVIEWED || t.status === ProcessingStatus.MANAGER_REVIEWED
  );

  for (let i = 0; i < reviewedTerms.length; i++) {
    const term = reviewedTerms[i];
    const hours = 2 + i;
    const result = await workflowEngine.executeStep3_WriteOffUpdate(
      term.id,
      '版权运营小鹿',
      hours,
      150,
      `HX20260606${String(i + 1).padStart(3, '0')}`
    );
    console.log(`  ${term.bandName}: ${result.message}`);
  }
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【数据一致性验证】明细、页面、接口返回同一份数据');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const listData = dataSource.getAuthorizationTerms('list');
  const detailData = dataSource.getAuthorizationTerms('detail');
  const exportData = exportService.exportAuthorizationTerms();

  console.log(`  列表视图: ${listData.length} 条`);
  console.log(`  详情视图: ${detailData.length} 条`);
  console.log(`  导出视图: ${exportData.data.length} 条`);
  console.log(`  三者一致: ${listData.length === detailData.length && detailData.length === exportData.data.length ? '✅ 是' : '❌ 否'}`);
  console.log(`  数据源实例: ${dataSource.getInstanceId()}`);
  console.log('');

  const consistency = dataSource.verifyDataConsistency();
  console.log(`  数据关联一致性: ${consistency.isConsistent ? '✅ 通过' : '❌ 不通过'}`);
  if (consistency.details.length > 0) {
    consistency.details.forEach(d => console.log(`    - ${d}`));
  }
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【证据链展示】店长追问时能回到原始证据');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const firstTerm = dataSource.getAuthorizationTerms()[0];
  if (firstTerm) {
    const changes = dataSource.getChangeRecords(firstTerm.id);
    const messages = dataSource.getTunerMessages(firstTerm.id);
    const writeOffs = dataSource.getWriteOffRecords(firstTerm.id);

    console.log(`  记录: ${firstTerm.bandName} (原始行号: ${firstTerm.originalRowNumber})`);
    console.log(`  当前状态: ${firstTerm.status}, 数据版本: v${firstTerm.version}`);
    console.log(`  变更记录: ${changes.length} 条`);
    changes.forEach(c => {
      console.log(`    - v${c.version}: ${c.fieldName} 从 [${c.oldValue}] → [${c.newValue}] (${c.changedBy}, ${c.changeReason})`);
    });
    console.log(`  调音师留言: ${messages.length} 条`);
    messages.forEach(m => {
      console.log(`    - ${m.tunerName}: ${m.content.substring(0, 30)}... (已查看: ${m.isReviewed})`);
    });
    console.log(`  核销单: ${writeOffs.length} 条`);
    writeOffs.forEach(w => {
      console.log(`    - ${w.writeOffNumber}: ${w.courseHours}课时 × ¥${w.unitPrice} = ¥${w.totalAmount}`);
    });
  }
  console.log('');

  console.log('══════════════════════════════════════════════════════════════');
  console.log('  演示完成！系统核心特性总结:');
  console.log('');
  console.log('  1. ✅ 原始行号保留: 每条记录都记录Excel原始行号');
  console.log('  2. ✅ 变更全追踪: 任何人任何修改都留下记录');
  console.log('  3. ✅ 四大自检: 重复导入/地区缺失/补录重算/导出一致');
  console.log('  4. ✅ 统一数据源: 列表/详情/导出读取同一份数据');
  console.log('  5. ✅ 店长复核: 地区异常不急着归正常, 留待店长确认');
  console.log('  6. ✅ 三步工作流: 导入→看留言→更新核销 完整闭环');
  console.log('  7. ✅ 证据链完整: 店长追问时可回溯每一步操作');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('');
}

runDemo().catch(console.error);
