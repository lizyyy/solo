const storage = require('./storage');
const samples = require('./samples');

samples.initSamples();

const BASE_URL = 'http://localhost:3000';

console.log('========================================');
console.log('审批流超时补偿 API 演示脚本');
console.log('========================================');
console.log('');

function logHeader(title) {
  console.log('');
  console.log('========================================');
  console.log(title);
  console.log('========================================');
  console.log('');
}

function logCurl(command) {
  console.log('curl 命令:');
  console.log(command);
  console.log('');
}

function logResponse(response) {
  console.log('响应:');
  console.log(JSON.stringify(response, null, 2));
  console.log('');
}

async function runDemo() {
  const purchaseTemplate = storage.getTemplateByType('purchase');
  const refundTemplate = storage.getTemplateByType('refund');
  const permissionTemplate = storage.getTemplateByType('permission');
  
  console.log('已创建的模板:');
  console.log(`  采购审批: ${purchaseTemplate.id}`);
  console.log(`  退款审批: ${refundTemplate.id}`);
  console.log(`  权限申请: ${permissionTemplate.id}`);
  console.log('');
  
  logHeader('场景一：正常审批流程（采购审批）');
  
  const process1 = storage.createProcess(
    purchaseTemplate.id,
    'applicant_zhang',
    {
      amount: 5000,
      description: '采购办公用品',
      items: ['笔记本电脑', '鼠标', '键盘']
    }
  );
  
  console.log('1. 发起采购申请（金额 ¥5,000）');
  logCurl(`curl -X POST ${BASE_URL}/api/processes \\
  -H "Content-Type: application/json" \\
  -d '{
    "templateId": "${purchaseTemplate.id}",
    "applicant": "applicant_zhang",
    "formData": {
      "amount": 5000,
      "description": "采购办公用品"
    }
  }'`);
  
  console.log('创建的流程ID:', process1.process.id);
  console.log('当前节点:', process1.nodes[0].name);
  console.log('当前审批人:', process1.nodes[0].assignee);
  console.log('超时时间:', process1.nodes[0].timeoutAt);
  console.log('');
  
  console.log('2. 部门经理审批通过 (dept_manager_a)');
  logCurl(`curl -X POST ${BASE_URL}/api/processes/${process1.process.id}/approve \\
  -H "Content-Type: application/json" \\
  -d '{
    "approver": "dept_manager_a",
    "comment": "同意采购"
  }'`);
  
  const approve1 = storage.approveNode(process1.process.id, 'dept_manager_a', '同意采购');
  logResponse(approve1);
  
  console.log('3. 财务审核通过 (finance_staff_a)');
  const approve2 = storage.approveNode(process1.process.id, 'finance_staff_a', '预算内，同意');
  logResponse(approve2);
  
  console.log('4. 总监审批通过 (director_a)');
  const approve3 = storage.approveNode(process1.process.id, 'director_a', '同意');
  logResponse(approve3);
  
  console.log('5. 查询流程详情');
  const detail1 = storage.getProcessDetail(process1.process.id);
  logCurl(`curl ${BASE_URL}/api/processes/${process1.process.id}`);
  console.log('流程状态:', detail1.process.status);
  console.log('人工操作记录:');
  detail1.histories.human.forEach((h, i) => {
    console.log(`  ${i+1}. ${h.actionType} - ${h.operator} - ${new Date(h.createdAt).toLocaleString()}`);
  });
  console.log('');
  
  logHeader('场景二：超时自动升级（退款审批）');
  
  const process2 = storage.createProcess(
    refundTemplate.id,
    'applicant_wang',
    {
      amount: 80000,
      description: '大金额退款',
      orderId: 'ORD-2024-001',
      reason: '商品质量问题'
    }
  );
  
  console.log('1. 发起退款申请（金额 ¥80,000，超时时间 30 分钟）');
  console.log('流程ID:', process2.process.id);
  console.log('当前节点:', process2.nodes[0].name);
  console.log('当前审批人:', process2.nodes[0].assignee);
  console.log('');
  
  console.log('2. 模拟超时（将超时时间设置为过去）');
  process2.nodes[0].timeoutAt = new Date(Date.now() - 60000);
  console.log('设置后超时时间:', process2.nodes[0].timeoutAt);
  console.log('');
  
  console.log('3. 执行超时扫描（第一次）');
  logCurl(`curl -X POST ${BASE_URL}/api/timeout/scan`);
  
  const scan1 = storage.scanAndEscalate();
  console.log('扫描结果:');
  console.log('  扫描总数:', scan1.totalScanned);
  console.log('  超时数量:', scan1.overdueCount);
  console.log('  升级数量:', scan1.escalatedCount);
  console.log('  跳过数量:', scan1.skippedCount);
  console.log('');
  
  const detail2a = storage.getProcessDetail(process2.process.id);
  console.log('当前节点审批人:', detail2a.currentNode.assignee);
  console.log('是否已升级:', detail2a.currentNode.escalated);
  console.log('超时原因:', JSON.stringify(detail2a.timeoutReason, null, 2));
  console.log('');
  
  console.log('4. 执行超时扫描（第二次，应该跳过已升级的）');
  const scan2 = storage.scanAndEscalate();
  console.log('第二次扫描结果:');
  console.log('  扫描总数:', scan2.totalScanned);
  console.log('  超时数量:', scan2.overdueCount);
  console.log('  升级数量:', scan2.escalatedCount);
  console.log('  跳过数量:', scan2.skippedCount);
  console.log('');
  
  console.log('5. 查询流程详情，查看自动升级记录');
  const detail2b = storage.getProcessDetail(process2.process.id);
  logCurl(`curl ${BASE_URL}/api/processes/${process2.process.id}`);
  console.log('自动操作记录:');
  detail2b.histories.auto.forEach((h, i) => {
    console.log(`  ${i+1}. ${h.actionType} - ${h.operator} - ${new Date(h.createdAt).toLocaleString()}`);
    console.log(`     详情: ${JSON.stringify(h.details)}`);
  });
  console.log('');
  
  logHeader('场景三：转派后通过（权限申请）');
  
  const process3 = storage.createProcess(
    permissionTemplate.id,
    'applicant_li',
    {
      riskLevel: 'high',
      description: '申请生产数据库访问权限',
      system: 'Production DB',
      permissionType: 'read_write'
    }
  );
  
  console.log('1. 发起权限申请（高风险，超时时间 30 分钟）');
  console.log('流程ID:', process3.process.id);
  console.log('当前节点:', process3.nodes[0].name);
  console.log('当前审批人:', process3.nodes[0].assignee);
  console.log('');
  
  console.log('2. 当前审批人 (dept_manager_a) 转派给 dept_manager_b');
  logCurl(`curl -X POST ${BASE_URL}/api/processes/${process3.process.id}/transfer \\
  -H "Content-Type: application/json" \\
  -d '{
    "currentApprover": "dept_manager_a",
    "newApprover": "dept_manager_b",
    "reason": "出差中，委托同事审批"
  }'`);
  
  const transfer = storage.transferNode(
    process3.process.id,
    'dept_manager_a',
    'dept_manager_b',
    '出差中，委托同事审批'
  );
  logResponse(transfer);
  console.log('');
  
  console.log('3. 查询流程详情，查看原审批人是否保留');
  const detail3a = storage.getProcessDetail(process3.process.id);
  console.log('当前审批人:', detail3a.currentNode.assignee);
  console.log('原审批人:', detail3a.currentNode.originalAssignee);
  console.log('所有审批人列表:', detail3a.currentNode.approvers);
  console.log('原始审批人列表:', detail3a.currentNode.originalApprovers);
  console.log('');
  
  console.log('4. 转派后的审批人 (dept_manager_b) 审批通过');
  const approve3a = storage.approveNode(process3.process.id, 'dept_manager_b', '同意');
  logResponse(approve3a);
  console.log('');
  
  console.log('5. 查询流程详情，查看操作历史');
  const detail3b = storage.getProcessDetail(process3.process.id);
  console.log('操作历史:');
  detail3b.histories.all.forEach((h, i) => {
    console.log(`  ${i+1}. [${h.source}] ${h.actionType} - ${h.operator}`);
  });
  console.log('');
  
  logHeader('场景四：撤回后扫描跳过（采购审批）');
  
  const process4 = storage.createProcess(
    purchaseTemplate.id,
    'applicant_zhao',
    {
      amount: 50000,
      description: '采购测试设备',
      items: ['测试仪器']
    }
  );
  
  console.log('1. 发起采购申请（金额 ¥50,000，超时时间 30 分钟）');
  console.log('流程ID:', process4.process.id);
  console.log('当前节点:', process4.nodes[0].name);
  console.log('当前审批人:', process4.nodes[0].assignee);
  console.log('');
  
  console.log('2. 模拟超时');
  process4.nodes[0].timeoutAt = new Date(Date.now() - 60000);
  console.log('');
  
  console.log('3. 申请人撤回申请');
  logCurl(`curl -X POST ${BASE_URL}/api/processes/${process4.process.id}/withdraw \\
  -H "Content-Type: application/json" \\
  -d '{
    "applicant": "applicant_zhao"
  }'`);
  
  const withdraw = storage.withdrawProcess(process4.process.id, 'applicant_zhao');
  logResponse(withdraw);
  console.log('');
  
  console.log('4. 执行超时扫描（应该跳过已撤回的流程）');
  const scan3 = storage.scanAndEscalate();
  console.log('扫描结果:');
  console.log('  扫描总数:', scan3.totalScanned);
  console.log('  超时数量:', scan3.overdueCount);
  console.log('  升级数量:', scan3.escalatedCount);
  console.log('  跳过数量:', scan3.skippedCount);
  console.log('');
  
  console.log('5. 查询已撤回流程详情');
  const detail4 = storage.getProcessDetail(process4.process.id);
  console.log('流程状态:', detail4.process.status);
  console.log('当前节点状态:', detail4.currentNode?.status);
  console.log('');
  
  console.log('6. 尝试审批已撤回的流程（应该失败）');
  try {
    storage.approveNode(process4.process.id, 'dept_manager_a', '同意');
  } catch (error) {
    console.log('错误信息:', error.message);
  }
  console.log('');
  
  logHeader('演示完成');
  console.log('所有演示场景已执行完毕！');
  console.log('');
  console.log('您可以使用以下 curl 命令查询各流程详情:');
  console.log('');
  console.log('正常审批流程:');
  console.log(`  curl ${BASE_URL}/api/processes/${process1.process.id}`);
  console.log('');
  console.log('超时升级流程:');
  console.log(`  curl ${BASE_URL}/api/processes/${process2.process.id}`);
  console.log('');
  console.log('转派流程:');
  console.log(`  curl ${BASE_URL}/api/processes/${process3.process.id}`);
  console.log('');
  console.log('撤回流程:');
  console.log(`  curl ${BASE_URL}/api/processes/${process4.process.id}`);
  console.log('');
  console.log('查询补偿记录:');
  console.log(`  curl ${BASE_URL}/api/compensations`);
  console.log('');
}

runDemo().catch(console.error);
