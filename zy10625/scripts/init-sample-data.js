const db = require('../src/database');
const services = require('../src/services');
const { v4: uuidv4 } = require('uuid');

async function initSampleData() {
  console.log('开始初始化样例数据...\n');

  console.log('=== 案例1: 完整流转 (创建 -> 修改 -> 审核通过 -> 已生效) ===');
  const contract1 = await services.createContract('HT20240001', '采购合同-办公设备', '张三');
  console.log('创建合同:', contract1.contract_no);
  
  const signatory1a = await services.createSignatory(contract1.id, '甲方科技有限公司', '甲方');
  const signatory1b = await services.createSignatory(contract1.id, '乙方贸易有限公司', '乙方');
  console.log('创建签署方:', signatory1a.signatory_name, signatory1b.signatory_name);
  
  const record1 = await services.createSignatureRecord(
    contract1.id, 
    signatory1a.id, 
    'SIG-2024-001', 
    '原签章遗失，申请重新签章', 
    '张三'
  );
  console.log('创建重签记录, 状态: 待签署, 版本:', record1.version);
  
  const modified1 = await services.modifySignatureRecord(
    record1.id, 
    'SIG-2024-001-RE', 
    '原签章遗失，重新申请，补充证明材料', 
    '李四'
  );
  console.log('修改重签记录, 状态: 重签中, 版本:', modified1.version);
  
  const audited1 = await services.auditSignatureRecord(
    record1.id, 
    true, 
    '王五', 
    '材料齐全，同意重签'
  );
  console.log('审核通过, 状态: 已生效, 版本:', audited1.version);
  
  console.log();

  console.log('=== 案例2: 驳回记录 (创建 -> 修改 -> 审核驳回) ===');
  const contract2 = await services.createContract('HT20240002', '服务合同-系统维护', '张三');
  console.log('创建合同:', contract2.contract_no);
  
  const signatory2 = await services.createSignatory(contract2.id, '维护服务公司', '乙方');
  console.log('创建签署方:', signatory2.signatory_name);
  
  const record2 = await services.createSignatureRecord(
    contract2.id, 
    signatory2.id, 
    'SIG-2024-002', 
    '合同条款变更需重签', 
    '张三'
  );
  console.log('创建重签记录, 状态: 待签署, 版本:', record2.version);
  
  const modified2 = await services.modifySignatureRecord(
    record2.id, 
    'SIG-2024-002-RE', 
    '合同条款变更，重新申请签章', 
    '李四'
  );
  console.log('修改重签记录, 状态: 重签中, 版本:', modified2.version);
  
  const audited2 = await services.auditSignatureRecord(
    record2.id, 
    false, 
    '王五', 
    '缺少变更审批文件，驳回'
  );
  console.log('审核驳回, 状态: 驳回, 版本:', audited2.version);
  
  console.log();

  console.log('=== 案例3: 撤回记录 (创建 -> 修改 -> 撤回) ===');
  const contract3 = await services.createContract('HT20240003', '租赁合同-办公场地', '张三');
  console.log('创建合同:', contract3.contract_no);
  
  const signatory3 = await services.createSignatory(contract3.id, '物业管理公司', '乙方');
  console.log('创建签署方:', signatory3.signatory_name);
  
  const record3 = await services.createSignatureRecord(
    contract3.id, 
    signatory3.id, 
    'SIG-2024-003', 
    '租期调整需重签', 
    '张三'
  );
  console.log('创建重签记录, 状态: 待签署, 版本:', record3.version);
  
  const modified3 = await services.modifySignatureRecord(
    record3.id, 
    'SIG-2024-003-RE', 
    '租期从3年调整为5年', 
    '李四'
  );
  console.log('修改重签记录, 状态: 重签中, 版本:', modified3.version);
  
  const withdrawn3 = await services.withdrawSignatureRecord(
    record3.id, 
    '张三', 
    '双方协商一致，暂不重签'
  );
  console.log('撤回申请, 状态: 作废, 版本:', withdrawn3.version);
  
  console.log();

  console.log('=== 案例4: 版本冲突检测 (模拟一方重签后另一方下载旧版本) ===');
  const contract4 = await services.createContract('HT20240004', '合作协议-战略合作', '张三');
  console.log('创建合同:', contract4.contract_no);
  
  const signatory4 = await services.createSignatory(contract4.id, '合作方有限公司', '乙方');
  console.log('创建签署方:', signatory4.signatory_name);
  
  const record4 = await services.createSignatureRecord(
    contract4.id, 
    signatory4.id, 
    'SIG-2024-004', 
    '合作范围扩大需重签', 
    '张三'
  );
  console.log('创建重签记录, 状态: 待签署, 版本:', record4.version);
  
  const modified4 = await services.modifySignatureRecord(
    record4.id, 
    'SIG-2024-004-V2', 
    '补充保密条款', 
    '李四'
  );
  console.log('修改重签记录, 状态: 重签中, 版本:', modified4.version);
  
  const modified4_2 = await services.modifySignatureRecord(
    record4.id, 
    'SIG-2024-004-V3', 
    '再次补充知识产权条款', 
    '李四'
  );
  console.log('再次修改, 状态: 重签中, 版本:', modified4_2.version);
  
  console.log('模拟签署方下载旧版本 v1...');
  const conflictCheck = await services.checkVersionConflict(record4.id, 1);
  console.log('冲突检测结果:', conflictCheck.has_conflict ? '发现冲突' : '无冲突');
  if (conflictCheck.has_conflict) {
    console.log('冲突描述:', conflictCheck.conflict_description);
    console.log('记录状态变为: 待人工处理');
  }
  
  console.log();

  console.log('=== 案例5: 批量导入 (包含坏行) ===');
  const importRecords = [
    {
      contract_no: 'HT2024-IMPORT-001',
      contract_name: '导入测试合同1',
      signatory_name: '测试公司A',
      signatory_type: '甲方',
      signature_no: 'SIG-IMPORT-001',
      resign_reason: '批量导入测试'
    },
    {
      contract_no: 'HT2024-IMPORT-002',
      contract_name: '',
      signatory_name: '测试公司B',
      signatory_type: '乙方',
      signature_no: 'SIG-IMPORT-002',
      resign_reason: '缺少合同名称，应该失败'
    },
    {
      contract_no: 'HT2024-IMPORT-003',
      contract_name: '导入测试合同3',
      signatory_name: '',
      signatory_type: '甲方',
      signature_no: 'SIG-IMPORT-003',
      resign_reason: '缺少签署方名称，应该失败'
    },
    {
      contract_no: 'HT2024-IMPORT-004',
      contract_name: '导入测试合同4',
      signatory_name: '测试公司D',
      signatory_type: '乙方',
      signature_no: 'SIG-IMPORT-004',
      resign_reason: '批量导入测试'
    }
  ];
  
  const importResult = await services.importRecords(importRecords, 'INIT-BATCH');
  console.log('批量导入结果:');
  importResult.forEach(item => {
    console.log(`  行${item.row}: ${item.status}${item.error ? ' - ' + item.error : ''}`);
  });

  console.log('\n=== 样例数据初始化完成 ===\n');
  
  const allRecords = await services.listSignatureRecords();
  console.log('当前所有记录统计:');
  const statusCount = {};
  allRecords.forEach(r => {
    const statusName = {
      pending_sign: '待签署',
      resigning: '重签中',
      effective: '已生效',
      cancelled: '作废',
      rejected: '驳回',
      pending_manual: '待人工处理'
    }[r.status] || r.status;
    statusCount[statusName] = (statusCount[statusName] || 0) + 1;
  });
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}条`);
  });
  console.log(`  总计: ${allRecords.length}条\n`);
  
  console.log('你可以运行 npm start 启动服务，然后通过以下方式验证:');
  console.log('  - 列表: GET http://localhost:3000/api/records');
  console.log('  - 详情: GET http://localhost:3000/api/records/{id}');
  console.log('  - 历史: GET http://localhost:3000/api/records/{id}/history');
  console.log('  - 导出: GET http://localhost:3000/api/export?format=json');
  console.log('  - 待人工处理: GET http://localhost:3000/api/pending-manual');
  
  process.exit(0);
}

initSampleData().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
