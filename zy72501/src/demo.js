const {
  clearAllData,
  importDesensitizationRule,
  addGrayBatch,
  getDesensitizationRules,
  getGrayBatches,
  getInspectionRecords,
  getExportResults,
  getPhoneMaskIssues,
  getAuditLogs,
  updatePhoneMaskIssue
} = require('./models');
const { runInspection, rerunInspection } = require('./inspectionEngine');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log('========================================');
  console.log('  RAG 引用缺失巡检 - 演示数据生成');
  console.log('========================================');
  console.log('');

  console.log('🗑️  清空历史数据...');
  clearAllData();
  await sleep(200);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('第一步：脱敏规则备注第一次导入');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const rule1 = importDesensitizationRule({
    name: '客户咨询记录脱敏规则',
    remark: '主流程：客户进线 → 坐席记录 → 敏感字段识别 → 脱敏处理 → 存储归档',
    mainProcess: '1. 客户进线，系统自动抓取对话内容\n2. 坐席人工补充客户诉求\n3. 系统识别手机号、身份证号等敏感字段\n4. 按规则进行脱敏遮蔽\n5. 脱敏后数据存入RAG知识库供检索',
    content: '本规则适用于所有客户咨询记录。敏感字段包括：手机号（11位，遮蔽中间4位）、身份证号（遮蔽中间8位）、地址（遮蔽详细门牌号）。'
  }, '系统管理员');

  console.log(`✅ 导入脱敏规则: ${rule1.name}`);
  console.log(`   ID: ${rule1.id}`);
  console.log(`   备注包含主流程: ${!!rule1.mainProcess}`);
  console.log('');

  const rule2 = importDesensitizationRule({
    name: '售后工单脱敏规则',
    remark: '',
    mainProcess: '',
    content: '售后工单处理记录，需脱敏客户联系方式。注意工单中有客户手机号：13800138000，这个号码上次导出时漏遮了。'
  }, '数据分析师小王');

  console.log(`✅ 导入脱敏规则: ${rule2.name}`);
  console.log(`   ID: ${rule2.id}`);
  console.log(`   ⚠️  注意：此规则未填写备注和主流程，且包含未脱敏手机号`);
  console.log('');

  console.log('🔍 第一次巡检（导入规则后立即执行）...');
  const result1 = runInspection('系统管理员');
  console.log('');
  console.log(result1.friendlyReport);
  console.log('');

  await sleep(500);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('第二步：算法运营老唐补看灰度批次');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const rules = getDesensitizationRules();
  const customerRule = rules.find(r => r.name === '客户咨询记录脱敏规则');

  const batch1 = addGrayBatch({
    batchNo: 'GRAY-2024-001',
    sceneStatement: '现场说法：灰度批次001测试中，客户进线咨询快递进度，坐席记录时系统自动识别到手机号139******78，已正确遮蔽。RAG引用来源：知识库第3.2.1节「快递查询场景脱敏规范」',
    relatedRuleId: customerRule.id,
    content: '本批次共测试100条对话，涉及快递查询、投诉建议、产品咨询三类场景。其中87条正确识别并脱敏敏感字段，13条需要人工复核。'
  }, '算法运营老唐');

  console.log(`✅ 补录灰度批次: ${batch1.batchNo}`);
  console.log(`   关联规则: ${customerRule.name}`);
  console.log(`   现场说法包含RAG引用: ✅`);
  console.log('');

  const batch2 = addGrayBatch({
    batchNo: 'GRAY-2024-002',
    sceneStatement: '现场说法：灰度批次002测试售后工单场景，发现工单备注中有客户手机号13900139000未遮蔽。',
    relatedRuleId: customerRule.id,
    content: '售后工单场景测试50条，发现3条手机号漏遮问题，需算法同事优化正则匹配规则。'
  }, '算法运营老唐');

  console.log(`✅ 补录灰度批次: ${batch2.batchNo}`);
  console.log(`   关联规则: ${customerRule.name}`);
  console.log(`   ⚠️  现场说法包含未脱敏手机号，且缺少RAG引用标注`);
  console.log('');

  console.log('🔍 第二次巡检（补录灰度批次后执行）...');
  const result2 = runInspection('算法运营老唐');
  console.log('');
  console.log(result2.friendlyReport);
  console.log('');

  await sleep(500);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('第三步：人工修正后重跑，脱敏导出更新');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const phoneIssues = getPhoneMaskIssues();
  console.log(`📱 当前待处理手机号漏遮问题: ${phoneIssues.length} 个`);
  console.log('');

  if (phoneIssues.length > 0) {
    const issueToReview = phoneIssues[0];
    console.log(`✍️  算法同事复核手机号问题: ${issueToReview.phoneNumber}`);
    console.log(`   来源: ${issueToReview.sourceName}`);
    console.log(`   原状态: ${issueToReview.status}`);
    
    updatePhoneMaskIssue(issueToReview.id, {
      status: 'confirmed',
      reviewedBy: '算法同事小李',
      reviewNote: '确认漏遮，已通知下游系统修复脱敏规则',
      reviewedAt: new Date().toISOString()
    }, '算法同事小李');
    
    console.log(`   ✅ 复核完成，状态更新为: confirmed`);
    console.log('');
  }

  console.log('🔄 重跑巡检（人工修正后）...');
  const result3 = rerunInspection('算法运营老唐', result2.inspection.id);
  console.log('');
  console.log(result3.friendlyReport);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 演示数据汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`📋 脱敏规则: ${getDesensitizationRules().length} 条`);
  console.log(`📦 灰度批次: ${getGrayBatches().length} 条`);
  console.log(`🔍 巡检记录: ${getInspectionRecords().length} 次`);
  console.log(`📄 导出报告: ${getExportResults().length} 份`);
  console.log(`📱 手机号问题: ${getPhoneMaskIssues().length} 个`);
  console.log(`📝 审计日志: ${getAuditLogs().length} 条`);
  console.log('');

  console.log('📝 审计日志一览（谁改了什么、为什么改）:');
  console.log('');
  getAuditLogs().slice(-8).forEach((log, idx) => {
    const actionMap = {
      'import_rule': '📥 导入规则',
      'add_gray_batch': '➕ 新增灰度批次',
      'run_inspection': '🔍 执行巡检',
      'update_phone_issue': '✏️  更新手机号问题',
      'rerun_inspection': '🔄 重跑巡检'
    };
    console.log(`  ${idx + 1}. ${actionMap[log.action] || log.action}`);
    console.log(`     操作人: ${log.operator}`);
    console.log(`     时间: ${new Date(log.timestamp).toLocaleString('zh-CN')}`);
    console.log(`     详情: ${JSON.stringify(log.details)}`);
    console.log('');
  });

  console.log('========================================');
  console.log('✅ 演示数据生成完毕！');
  console.log('');
  console.log('💡 给新人讲流程的要点：');
  console.log('  1. 先导入脱敏规则（带主流程备注）');
  console.log('  2. 算法运营老唐补录灰度批次（带现场说法）');
  console.log('  3. 运行巡检，把两边证据整合到同一份报告');
  console.log('  4. 发现手机号漏遮别急着改，先留待算法同事复核');
  console.log('  5. 人工修正后重跑，导出报告自动更新');
  console.log('  6. 所有操作都有审计日志，可追溯谁改了什么');
  console.log('');
  console.log('🚀 启动 Web 小看板: npm start');
  console.log('🚀 使用命令行工具: npm run cli -- --help');
  console.log('========================================');
}

runDemo().catch(console.error);
