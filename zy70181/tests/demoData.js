const { initDatabase, exec } = require('../db/database');
const dateUtils = require('../utils/dateUtils');
const receivableService = require('../services/receivableService');
const agingService = require('../services/agingService');
const collectionService = require('../services/collectionService');
const { initSchema } = require('../db/schema');

async function seedDemoData() {
  await initDatabase();
  initSchema();
  
  console.log('=== 开始填充演示数据 ===\n');
  
  exec('DELETE FROM task_workflow');
  exec('DELETE FROM collection_tasks');
  exec('DELETE FROM payment_allocations');
  exec('DELETE FROM payments');
  exec('DELETE FROM receivable_ledger');
  exec('DELETE FROM invoices');
  exec('DELETE FROM contracts');
  exec('DELETE FROM bad_debt_records');
  exec('DELETE FROM payment_promises');
  exec('DELETE FROM invoice_aging');
  exec('DELETE FROM customers');
  
  const today = dateUtils.getToday();
  
  const cust1Result = receivableService.createCustomer({
    name: '北京科技有限公司',
    code: 'CUST001',
    contactPerson: '张经理',
    phone: '13800138001',
    creditRating: 'normal'
  });
  const customer1Id = cust1Result.lastInsertRowid;
  console.log('✓ 创建客户: 北京科技有限公司 (CUST001)');
  
  const cust2Result = receivableService.createCustomer({
    name: '上海贸易公司',
    code: 'CUST002',
    contactPerson: '李总',
    phone: '13900139002',
    creditRating: 'high'
  });
  const customer2Id = cust2Result.lastInsertRowid;
  console.log('✓ 创建客户: 上海贸易公司 (CUST002)');
  
  const cust3Result = receivableService.createCustomer({
    name: '广州制造集团',
    code: 'CUST003',
    contactPerson: '王总监',
    phone: '13700137003',
    creditRating: 'low'
  });
  const customer3Id = cust3Result.lastInsertRowid;
  console.log('✓ 创建客户: 广州制造集团 (CUST003)');
  
  const contract1Result = receivableService.createContract({
    customerId: customer1Id,
    contractNo: 'HT2024001',
    contractName: '软件开发服务合同',
    totalAmount: 500000,
    signedDate: '2024-01-15',
    startDate: '2024-02-01',
    endDate: '2024-12-31'
  });
  const contract1Id = contract1Result.lastInsertRowid;
  console.log('✓ 创建合同: HT2024001 - 软件开发服务合同 (50万)');
  
  const invoice1Result = receivableService.createInvoice({
    customerId: customer1Id,
    contractId: contract1Id,
    invoiceNo: 'INV2024001',
    invoiceDate: '2024-02-01',
    dueDate: '2024-03-02',
    amount: 200000,
    taxAmount: 12000
  });
  const invoice1Id = invoice1Result.lastInsertRowid;
  console.log('✓ 创建发票: INV2024001 - 20万 (到期: 2024-03-02, 已逾期很久)');
  
  const invoice2Result = receivableService.createInvoice({
    customerId: customer1Id,
    contractId: contract1Id,
    invoiceNo: 'INV2024002',
    invoiceDate: '2024-05-01',
    dueDate: '2024-06-01',
    amount: 150000,
    taxAmount: 9000
  });
  const invoice2Id = invoice2Result.lastInsertRowid;
  console.log('✓ 创建发票: INV2024002 - 15万 (到期: 2024-06-01)');
  
  const invoice3Result = receivableService.createInvoice({
    customerId: customer1Id,
    contractId: contract1Id,
    invoiceNo: 'INV2024003',
    invoiceDate: dateUtils.addDays(today, -10),
    dueDate: dateUtils.addDays(today, 20),
    amount: 150000,
    taxAmount: 9000
  });
  const invoice3Id = invoice3Result.lastInsertRowid;
  console.log('✓ 创建发票: INV2024003 - 15万 (未到期)');
  
  const contract2Result = receivableService.createContract({
    customerId: customer2Id,
    contractNo: 'HT2024002',
    contractName: '硬件设备采购合同',
    totalAmount: 800000,
    signedDate: '2024-03-01',
    startDate: '2024-03-15',
    endDate: '2024-09-30'
  });
  const contract2Id = contract2Result.lastInsertRowid;
  console.log('✓ 创建合同: HT2024002 - 硬件设备采购 (80万)');
  
  const invoice4Result = receivableService.createInvoice({
    customerId: customer2Id,
    contractId: contract2Id,
    invoiceNo: 'INV2024004',
    invoiceDate: '2024-04-01',
    dueDate: dateUtils.addDays(today, -15),
    amount: 400000,
    taxAmount: 24000
  });
  const invoice4Id = invoice4Result.lastInsertRowid;
  console.log('✓ 创建发票: INV2024004 - 40万 (逾期15天)');
  
  const invoice5Result = receivableService.createInvoice({
    customerId: customer2Id,
    contractId: contract2Id,
    invoiceNo: 'INV2024005',
    invoiceDate: dateUtils.addDays(today, -5),
    dueDate: dateUtils.addDays(today, 25),
    amount: 400000,
    taxAmount: 24000
  });
  const invoice5Id = invoice5Result.lastInsertRowid;
  console.log('✓ 创建发票: INV2024005 - 40万 (未到期)');
  
  const contract3Result = receivableService.createContract({
    customerId: customer3Id,
    contractNo: 'HT2024003',
    contractName: '年度运维服务合同',
    totalAmount: 120000,
    signedDate: '2023-12-01',
    startDate: '2024-01-01',
    endDate: '2024-12-31'
  });
  const contract3Id = contract3Result.lastInsertRowid;
  console.log('✓ 创建合同: HT2024003 - 年度运维 (12万)');
  
  const invoice6Result = receivableService.createInvoice({
    customerId: customer3Id,
    contractId: contract3Id,
    invoiceNo: 'INV2024006',
    invoiceDate: '2024-01-01',
    dueDate: '2024-01-31',
    amount: 60000,
    taxAmount: 3600
  });
  const invoice6Id = invoice6Result.lastInsertRowid;
  console.log('✓ 创建发票: INV2024006 - 6万 (逾期很久，可能坏账)');
  
  const invoice7Result = receivableService.createInvoice({
    customerId: customer3Id,
    contractId: contract3Id,
    invoiceNo: 'INV2024007',
    invoiceDate: '2024-07-01',
    dueDate: dateUtils.addDays(today, -45),
    amount: 60000,
    taxAmount: 3600
  });
  const invoice7Id = invoice7Result.lastInsertRowid;
  console.log('✓ 创建发票: INV2024007 - 6万 (逾期45天)');
  
  console.log('\n=== 模拟部分回款 ===\n');
  
  receivableService.recordPayment({
    customerId: customer1Id,
    paymentNo: 'PAY2024001',
    paymentDate: '2024-04-15',
    amount: 100000,
    paymentMethod: '银行转账',
    remark: '首期回款',
    allocations: [
      { invoiceId: invoice1Id, amount: 100000 }
    ]
  });
  console.log('✓ 回款: PAY2024001 - 10万，核销 INV2024001');
  
  console.log('\n=== 运行账龄计算 ===\n');
  const agingResults = agingService.runAgingCalculation();
  console.log(`✓ 账龄计算完成，共 ${agingResults.length} 张发票有逾期余额`);
  
  for (const aging of agingResults) {
    console.log(`  - ${aging.invoiceNo}: 余额${aging.balance.toLocaleString()}元, ${aging.bucketName}, ${aging.overdueDays}天`);
  }
  
  console.log('\n=== 创建催收任务 ===\n');
  
  const task1Result = collectionService.createCollectionTask({
    customerId: customer1Id,
    invoiceId: invoice1Id,
    contractId: contract1Id,
    assignedTo: '张三',
    priority: 'high'
  });
  console.log(`✓ 创建任务: ${task1Result.taskCode} - INV2024001 余款催收`);
  
  const task2Result = collectionService.createCollectionTask({
    customerId: customer2Id,
    invoiceId: invoice4Id,
    contractId: contract2Id,
    assignedTo: '李四',
    priority: 'normal'
  });
  console.log(`✓ 创建任务: ${task2Result.taskCode} - INV2024004 催收`);
  
  const task3Result = collectionService.createCollectionTask({
    customerId: customer3Id,
    invoiceId: invoice6Id,
    contractId: contract3Id,
    assignedTo: '王五',
    priority: 'urgent'
  });
  console.log(`✓ 创建任务: ${task3Result.taskCode} - INV2024006 催收`);
  
  console.log('\n=== 模拟工作流审批 ===\n');
  
  let task1 = collectionService.getTaskDetail(task1Result.taskId);
  console.log(`任务1 当前步骤: ${task1.currentStepInfo?.name} (${task1.current_status})`);
  
  collectionService.advanceTask({
    taskId: task1Result.taskId,
    operator: '张三',
    comment: '已整理催收材料，提交审核'
  });
  task1 = collectionService.getTaskDetail(task1Result.taskId);
  console.log(`✓ 推进到: ${task1.currentStepInfo?.name}`);
  
  collectionService.rejectTask({
    taskId: task1Result.taskId,
    operator: '领导A',
    reason: '催收等级有误，该发票逾期超过100天，应为四级催收，需要重新评估'
  });
  task1 = collectionService.getTaskDetail(task1Result.taskId);
  console.log(`✗ 被拒绝: 原因: ${task1.lastRejectRecord?.reject?.comment}`);
  
  if (task1.blockPoint) {
    console.log(`  卡点: ${task1.blockPoint.stepName}, 操作人: ${task1.blockPoint.operator}`);
  }
  
  collectionService.restartTaskAfterReject({
    taskId: task1Result.taskId,
    operator: '张三',
    comment: '已重新核对账龄，确实超过90天，按四级催收处理'
  });
  task1 = collectionService.getTaskDetail(task1Result.taskId);
  console.log(`✓ 重新提交后状态: ${task1.current_status}`);
  
  console.log('\n=== 记录承诺回款 ===\n');
  
  const promiseResult = collectionService.recordPaymentPromise({
    taskId: task1Result.taskId,
    customerId: customer1Id,
    invoiceId: invoice1Id,
    promisedAmount: 50000,
    promisedDate: dateUtils.addDays(today, 10),
    remark: '客户承诺下周三付款'
  });
  console.log(`✓ 记录承诺回款: 5万, 承诺日期: ${dateUtils.addDays(today, 10)}`);
  
  console.log('\n=== 坏账标记 ===\n');
  
  const badDebtResult = collectionService.markBadDebt({
    customerId: customer3Id,
    invoiceId: invoice6Id,
    badDebtAmount: 60000,
    reason: '客户经营不善，已失联，多次催收无果',
    approvedBy: null
  });
  console.log(`✓ 提交坏账申请: INV2024006 - 6万元`);
  
  collectionService.approveBadDebt(badDebtResult.lastInsertRowid, '财务总监');
  console.log('✓ 坏账已批准并核销');
  
  console.log('\n=== 演示数据填充完成 ===\n');
  console.log('你现在可以:');
  console.log('  1. 运行 npm install 安装依赖');
  console.log('  2. 运行 npm start 启动服务');
  console.log('  3. 访问 http://localhost:3000/health 检查服务状态');
  console.log('  4. 使用下面的 API 进行测试');
  
  return {
    customers: { customer1Id, customer2Id, customer3Id },
    invoices: { invoice1Id, invoice2Id, invoice3Id, invoice4Id, invoice5Id, invoice6Id, invoice7Id },
    tasks: { task1Id: task1Result.taskId, task2Id: task2Result.taskId, task3Id: task3Result.taskId }
  };
}

if (require.main === module) {
  seedDemoData().catch(err => {
    console.error('填充演示数据失败:', err);
    process.exit(1);
  });
}

module.exports = { seedDemoData };
