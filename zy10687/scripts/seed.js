const { sequelize, FinanceOrder } = require('../src/models');
const ReceivableService = require('../src/services/receivableService');
const ImportService = require('../src/services/importService');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('开始造数...');
  
  await sequelize.sync({ force: true });
  
  const financeOrder = await FinanceOrder.create({
    id: uuidv4(),
    financeOrderNo: 'FIN2024010001',
    customerId: uuidv4(),
    customerName: '测试客户A',
    amount: 500000,
    isFrozen: true,
    freezeReason: '风控审核中'
  });

  const receivable1 = await ReceivableService.createReceivable({
    receivableNo: 'REC2024010001',
    customerId: financeOrder.customerId,
    customerName: '测试客户A',
    amount: 100000,
    dueDate: '2024-06-30',
    lockReason: '逾期未回款',
    financeOrderId: financeOrder.id,
    financeOrderNo: financeOrder.financeOrderNo,
    financeFrozen: true,
    operationSource: 'WEB',
    operator: '张三',
    operatorId: uuidv4()
  });
  console.log('创建账款1:', receivable1.receivableNo);

  await ReceivableService.applyUnlock(receivable1.id, {
    operationSource: 'WEB',
    operator: '李四',
    operatorId: uuidv4(),
    unlockMaterials: {
      paymentProof: 'PAY202401001',
      approvalDoc: 'APV2024001'
    },
    remark: '已收到回款，申请解锁'
  });
  console.log('账款1 申请解锁');

  await ReceivableService.approveUnlock(receivable1.id, {
    operationSource: 'WEB',
    operator: '王五',
    operatorId: uuidv4(),
    remark: '审核通过，解锁'
  });
  console.log('账款1 审核通过，完成完整流转');

  const receivable2 = await ReceivableService.createReceivable({
    receivableNo: 'REC2024010002',
    customerId: financeOrder.customerId,
    customerName: '测试客户A',
    amount: 200000,
    dueDate: '2024-07-15',
    lockReason: '重复质押',
    financeOrderId: financeOrder.id,
    financeOrderNo: financeOrder.financeOrderNo,
    financeFrozen: true,
    operationSource: 'API',
    operator: '系统用户',
    operatorId: uuidv4()
  });
  console.log('创建账款2:', receivable2.receivableNo);

  await ReceivableService.applyUnlock(receivable2.id, {
    operationSource: 'WEB',
    operator: '李四',
    operatorId: uuidv4(),
    unlockMaterials: {
      statement: 'STMT2024001'
    },
    remark: '已解除质押，申请解锁'
  });
  console.log('账款2 申请解锁');

  await ReceivableService.rejectUnlock(receivable2.id, {
    operationSource: 'WEB',
    operator: '王五',
    operatorId: uuidv4(),
    rejectReason: '材料不齐全，缺少质押解除证明',
    remark: '审核拒绝'
  });
  console.log('账款2 审核拒绝，作为冲突记录');

  const importRows = [
    {
      receivableNo: 'REC2024010003',
      customerId: uuidv4(),
      customerName: '测试客户B',
      amount: 150000,
      dueDate: '2024-08-01',
      lockReason: '合同纠纷',
      financeFrozen: false
    },
    {
      receivableNo: '',
      customerId: '',
      customerName: '',
      amount: -100,
      dueDate: 'invalid-date',
      lockReason: ''
    },
    {
      receivableNo: 'REC2024010004',
      customerId: uuidv4(),
      customerName: '测试客户C',
      amount: 80000,
      dueDate: '2024-09-01',
      lockReason: '信息异常'
    }
  ];

  const importResult = await ImportService.importReceivables(importRows, '导入管理员');
  console.log('批量导入结果:', importResult);

  console.log('\n造数完成！');
  console.log('========================================');
  console.log('1. 完整流转记录: REC2024010001 (已锁定 -> 解锁申请 -> 已解锁)');
  console.log('2. 冲突记录: REC2024010002 (已锁定 -> 解锁申请 -> 被拒绝)');
  console.log(`3. 导入坏行批次: ${importResult.batchNo} (第2行为坏数据)`);
  console.log('========================================');

  process.exit(0);
}

seed().catch(console.error);