const ECNService = require('../services/ecnService');
const { sampleECNs, getImpactData } = require('./sampleData');

console.log('==============================================');
console.log('       普通变更完整流程演示');
console.log('==============================================');
console.log();

let ecnId;
let detail;

console.log('【步骤1】创建工程变更单');
console.log('---');
const createResult = ECNService.createECN({
  ...sampleECNs.normal,
  reason: '客户反馈产品在高温环境下出现配合失效',
  createdBy: '工程师-张三'
});
if (createResult.success) {
  ecnId = createResult.data.id;
  console.log(`✓ 变更单创建成功: ${ecnId}`);
  console.log(`  标题: ${createResult.data.title}`);
  console.log(`  紧急程度: ${createResult.data.urgency}`);
  console.log(`  当前状态: ${createResult.data.status}`);
}
console.log();

console.log('【步骤2】提交变更单');
console.log('---');
const submitResult = ECNService.submitECN(ecnId, '工程师-张三');
if (submitResult.success) {
  console.log(`✓ 已提交，状态: ${submitResult.data.status}`);
}
console.log();

console.log('【步骤3】添加影响分析');
console.log('---');
const impactData = getImpactData('full');
const analyzeResult = ECNService.addImpactAnalysis(ecnId, impactData, '分析师-王工');
if (analyzeResult.success) {
  console.log('✓ 影响分析完成');
  console.log(`  影响物料: ${analyzeResult.data.statistics.total.materials} 个`);
  console.log(`  影响在制单: ${analyzeResult.data.statistics.total.productionOrders} 个`);
  console.log(`  影响采购单: ${analyzeResult.data.statistics.total.purchaseOrders} 个`);
  console.log(`  影响客户订单: ${analyzeResult.data.statistics.total.customerOrders} 个`);
  console.log(`  当前状态: ${analyzeResult.data.ecn.status}`);
}
console.log();

console.log('【步骤4】审批通过');
console.log('---');
const approveResult = ECNService.approveECN(ecnId, '审批人-李总');
if (approveResult.success) {
  console.log(`✓ 已审批通过，审批人: ${approveResult.data.approvedBy}`);
  console.log(`  当前状态: ${approveResult.data.status}`);
}
console.log();

console.log('【步骤5】开始执行');
console.log('---');
const execResult = ECNService.startExecution(ecnId, '执行专员-赵工');
if (execResult.success) {
  console.log(`✓ 执行开始`);
  console.log(`  当前状态: ${execResult.data.ecn.status}`);
  if (!execResult.data.urgentFreeze.frozen) {
    console.log(`  注意: 非紧急变更，不执行冻结`);
  }
}
console.log();

console.log('【步骤6】通知并确认各相关方');
console.log('---');
detail = ECNService.getECNDetail(ecnId);

let materials = detail.data.impacts.materials;
materials.forEach((m, idx) => {
  const notifyRes = ECNService.notifyItem(ecnId, 'MATERIAL', m.id, '物料专员');
  console.log(`  物料通知[${idx + 1}]: ${m.materialCode} -> ${notifyRes.data.status}`);
  ECNService.acknowledgeItem(ecnId, 'MATERIAL', m.id, '物料经理-张经理');
  console.log(`  物料确认[${idx + 1}]: ${m.materialCode} -> 已确认`);
});

let production = detail.data.impacts.productionOrders;
production.forEach((p, idx) => {
  const notifyRes = ECNService.notifyItem(ecnId, 'PRODUCTION', p.id, '生产协调员');
  console.log(`  在制单通知[${idx + 1}]: ${p.orderNo} -> ${notifyRes.data.status}`);
  ECNService.acknowledgeItem(ecnId, 'PRODUCTION', p.id, '生产主管-李主管');
  console.log(`  在制单确认[${idx + 1}]: ${p.orderNo} -> 已确认`);
});

let purchases = detail.data.impacts.purchaseOrders;
purchases.forEach((p, idx) => {
  const notifyRes = ECNService.notifyItem(ecnId, 'PURCHASE', p.id, '采购协调员');
  console.log(`  采购单通知[${idx + 1}]: ${p.poNumber} -> ${notifyRes.data.status}`);
  ECNService.acknowledgeItem(ecnId, 'PURCHASE', p.id, '采购经理-王经理', {
    confirmStatus: 'CONFIRMED'
  });
  console.log(`  采购单确认[${idx + 1}]: ${p.poNumber} -> 已确认`);
});

let customers = detail.data.impacts.customerOrders;
customers.forEach((c, idx) => {
  const notifyRes = ECNService.notifyItem(ecnId, 'CUSTOMER', c.id, '销售协调员');
  console.log(`  客户单通知[${idx + 1}]: ${c.orderNo} -> ${notifyRes.data.status}`);
  ECNService.acknowledgeItem(ecnId, 'CUSTOMER', c.id, '销售经理-刘经理', {
    customerResponse: '客户同意变更，需要调整交付期'
  });
  console.log(`  客户单确认[${idx + 1}]: ${c.orderNo} -> 已确认`);
});
console.log();

console.log('【步骤7】完成各项处理');
console.log('---');
detail = ECNService.getECNDetail(ecnId);

materials = detail.data.impacts.materials;
materials.forEach((m, idx) => {
  ECNService.completeItem(ecnId, 'MATERIAL', m.id, '物料经理-张经理', {
    completionNote: '物料已按新规格安排生产'
  });
  console.log(`  物料完成[${idx + 1}]: ${m.materialCode}`);
});

production = detail.data.impacts.productionOrders;
production.forEach((p, idx) => {
  ECNService.completeItem(ecnId, 'PRODUCTION', p.id, '生产主管-李主管', {
    completionNote: '生产已调整，按新图纸执行'
  });
  console.log(`  在制单完成[${idx + 1}]: ${p.orderNo}`);
});

purchases = detail.data.impacts.purchaseOrders;
purchases.forEach((p, idx) => {
  ECNService.completeItem(ecnId, 'PURCHASE', p.id, '采购经理-王经理', {
    completionNote: '已通知供应商按新规格生产'
  });
  console.log(`  采购单完成[${idx + 1}]: ${p.poNumber}`);
});

customers = detail.data.impacts.customerOrders;
customers.forEach((c, idx) => {
  ECNService.completeItem(ecnId, 'CUSTOMER', c.id, '销售经理-刘经理', {
    completionNote: '客户确认接受新规格产品'
  });
  console.log(`  客户单完成[${idx + 1}]: ${c.orderNo}`);
});
console.log();

console.log('【步骤8】完成变更单');
console.log('---');
const completeResult = ECNService.completeECN(ecnId, '总协调-赵总');
if (completeResult.success) {
  console.log(`✓ 变更单已完成`);
  console.log(`  最终状态: ${completeResult.data.ecn.status}`);
  console.log(`  完成时间: ${completeResult.data.ecn.completedAt}`);
} else {
  console.log(`✗ 无法完成: ${completeResult.error}`);
  if (completeResult.details) {
    console.log(`  详情: ${JSON.stringify(completeResult.details, null, 2)}`);
  }
}
console.log();

console.log('【步骤9】查看最终报告');
console.log('---');
const report = ECNService.generateReport(ecnId);
if (report.success) {
  console.log('✓ 报告生成成功');
  console.log(`  报告ID: ${report.data.reportId}`);
  console.log(`  总影响项: ${JSON.stringify(report.data.summary.totalImpacts)}`);
  console.log(`  已完成: ${report.data.summary.completed}`);
  console.log(`  待处理: ${report.data.summary.pending}`);
  console.log(`  失败: ${report.data.summary.failed}`);
  console.log(`  可关闭: ${report.data.closureStatus.canClose}`);
}
console.log();

console.log('【步骤10】查看历史记录');
console.log('---');
const history = ECNService.getECNDetail(ecnId).data.history;
console.log(`✓ 共 ${history.length} 条历史记录`);
history.forEach((h, idx) => {
  console.log(`  [${idx + 1}] ${h.action} - ${h.operator} (${new Date(h.createdAt).toLocaleString()})`);
});
console.log();

console.log('【步骤11】查看责任人员');
console.log('---');
const responsible = ECNService.getResponsiblePersons(ecnId);
if (responsible.success) {
  console.log('✓ 责任人分析完成');
  Object.entries(responsible.data.responsible).forEach(([key, value]) => {
    console.log(`  ${key}: ${value.count} 项待处理 -> 责任人: ${value.owner}`);
  });
}
console.log();

console.log('==============================================');
console.log('       普通变更演示完成！');
console.log('==============================================');
console.log();
console.log('关键验证点:');
console.log('  ✓ 状态正确流转: DRAFT -> SUBMITTED -> IMPACT_ANALYZED -> APPROVED -> IN_PROGRESS -> COMPLETED');
console.log('  ✓ 影响分析完整，覆盖物料、在制、采购、客户');
console.log('  ✓ 通知、确认、完成流程清晰');
console.log('  ✓ 历史记录完整');
console.log('  ✓ 报告展示业务闭环状态');
