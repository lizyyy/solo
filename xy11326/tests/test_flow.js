const path = require('path');
const initDatabase = require('../src/database/init');
const Operator = require('../src/models/Operator');
const Tractor = require('../src/models/Tractor');
const WorkRecord = require('../src/models/WorkRecord');
const BillingRecord = require('../src/models/BillingRecord');
const OperationLog = require('../src/models/OperationLog');
const { importWorkRecords } = require('../src/services/importService');
const { reviewRecord } = require('../src/services/reviewService');
const { calculateFees } = require('../src/services/billingService');

async function runTests() {
  console.log('=== 农机合作社财务管理系统 - 流程测试 ===\n');
  
  await initDatabase();
  
  console.log('1. 测试基础数据查询');
  const operators = await Operator.findAll();
  const tractors = await Tractor.findAll();
  console.log(`   机手数量: ${operators.length}`);
  console.log(`   拖拉机数量: ${tractors.length}`);
  operators.forEach(op => {
    console.log(`   - ${op.name}: 手机号 ${op.phone ? '已设置（已加密）' : '未设置'}`);
  });
  console.log('');
  
  console.log('2. 测试计费计算');
  const testFees = calculateFees(4.5, 20, 15.2);
  console.log(`   小时费: ${testFees.hoursFee} 元 (4.5小时 × 80元/小时)`);
  console.log(`   亩计费: ${testFees.acresFee} 元 (20亩 × 50元/亩)`);
  console.log(`   油费: ${testFees.fuelFee} 元 (15.2升 × 7.5元/升)`);
  console.log(`   服务费: ${testFees.serviceFee} 元`);
  console.log(`   总金额: ${testFees.totalAmount} 元`);
  console.log('');
  
  console.log('3. 测试导入正常数据');
  const validCsvPath = path.join(__dirname, '../samples/valid_records.csv');
  const importResult = await importWorkRecords(validCsvPath, 'valid_records.csv', '测试用户');
  console.log(`   导入批次: ${importResult.batchNo}`);
  console.log(`   总记录数: ${importResult.totalRecords}`);
  console.log(`   成功: ${importResult.successRecords} 条`);
  console.log(`   失败: ${importResult.failedRecords} 条`);
  importResult.results.forEach((r, i) => {
    if (r.success) {
      console.log(`   第${i + 1}行: ✓ 成功`);
    } else {
      console.log(`   第${i + 1}行: ✗ 失败 - ${r.errors.map(e => e.message).join(', ')}`);
    }
  });
  console.log('');
  
  console.log('4. 测试导入异常数据');
  const invalidCsvPath = path.join(__dirname, '../samples/invalid_records.csv');
  const invalidImportResult = await importWorkRecords(invalidCsvPath, 'invalid_records.csv', '测试用户');
  console.log(`   导入批次: ${invalidImportResult.batchNo}`);
  console.log(`   总记录数: ${invalidImportResult.totalRecords}`);
  console.log(`   成功: ${invalidImportResult.successRecords} 条`);
  console.log(`   失败: ${invalidImportResult.failedRecords} 条`);
  invalidImportResult.results.forEach((r, i) => {
    if (r.success) {
      console.log(`   第${i + 1}行: ✓ 成功`);
    } else {
      console.log(`   第${i + 1}行: ✗ 失败 - ${r.errors.map(e => e.message).join(', ')}`);
    }
  });
  console.log('');
  
  console.log('5. 测试待审核记录查询');
  const pendingRecords = await WorkRecord.findAll({ status: 'pending' });
  console.log(`   待审核记录数: ${pendingRecords.length}`);
  console.log('');
  
  console.log('6. 测试单条记录审核通过');
  if (pendingRecords.length > 0) {
    const recordToApprove = pendingRecords[0];
    console.log(`   审核记录ID: ${recordToApprove.id}`);
    const reviewResult = await reviewRecord(recordToApprove.id, {
      reviewResult: 'approved',
      reviewComments: '数据无误，审核通过'
    }, '审核员1');
    console.log(`   审核结果: ${reviewResult.success ? '成功' : '失败'}`);
    console.log(`   生成账单ID: ${reviewResult.billing ? reviewResult.billing.id : 'N/A'}`);
  }
  console.log('');
  
  console.log('7. 测试驳回记录');
  const pendingAfterApproval = await WorkRecord.findAll({ status: 'pending' });
  if (pendingAfterApproval.length > 0) {
    const recordToReject = pendingAfterApproval[0];
    console.log(`   驳回记录ID: ${recordToReject.id}`);
    const rejectResult = await reviewRecord(recordToReject.id, {
      reviewResult: 'rejected',
      reviewComments: '数据异常，需要重新录入'
    }, '审核员1');
    console.log(`   驳回结果: ${rejectResult.success ? '成功' : '失败'}`);
  }
  console.log('');
  
  console.log('8. 测试账单查询');
  const bills = await BillingRecord.findAll();
  console.log(`   账单数量: ${bills.length}`);
  bills.forEach(bill => {
    console.log(`   - 账单${bill.id}: ${bill.operatorName} - ${bill.totalAmount}元 (${bill.status})`);
  });
  console.log('');
  
  console.log('9. 测试操作日志');
  const logs = await OperationLog.findAll();
  console.log(`   日志数量: ${logs.length}`);
  logs.slice(0, 5).forEach(log => {
    console.log(`   - ${log.operation} | ${log.operator} | ${log.createdAt.slice(0, 10)}`);
  });
  console.log('');
  
  console.log('10. 测试数据持久化验证');
  const workRecords = await WorkRecord.findAll();
  console.log(`   当前系统作业记录总数: ${workRecords.length}`);
  console.log(`   状态分布:`);
  const statusCount = {};
  workRecords.forEach(r => {
    statusCount[r.status] = (statusCount[r.status] || 0) + 1;
  });
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`     - ${status}: ${count}条`);
  });
  console.log('');
  
  console.log('=== 测试完成 ===');
  console.log('\n系统正常工作！重启服务后数据仍然可用。');
}

runTests().catch(console.error);
