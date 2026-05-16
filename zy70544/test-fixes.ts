async function runTest() {
  const fetch = (await import('node-fetch')).default;
  const BASE = 'http://localhost:3000/api/v1';
  let appId: string;

  console.log('=== 测试1: 创建申请并验证影响明细字段映射 ===\n');
  
  const createResp = await fetch(`${BASE}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: `test-key-${Date.now()}`,
      billingMonth: '2024-05',
      customerAccount: 'CUST001',
      customerName: '测试客户',
      reasonCategory: 'PRICE_ADJUSTMENT',
      reasonDetail: '测试字段映射问题',
      triggerSource: '财务对账',
      impactDetails: [
        {
          itemCode: 'ITEM001',
          itemName: '基础服务费',
          originalAmount: 1000,
          newAmount: 1500,
          remarks: '测试'
        }
      ],
      createdBy: '测试用户'
    })
  });
  
  const createData: any = await createResp.json();
  appId = createData.data.id;
  console.log('创建申请成功, ID:', appId);
  
  const detail = createData.data.impactDetails[0];
  console.log('影响明细字段:');
  console.log('  - itemCode (驼峰):', detail.itemCode);
  console.log('  - item_code (蛇形):', detail.item_code);
  console.log('  - originalAmount (驼峰):', detail.originalAmount);
  console.log('  - original_amount (蛇形):', detail.original_amount);
  
  const hasCamelCase = detail.itemCode && detail.originalAmount;
  const hasSnakeCase = detail.item_code || detail.original_amount;
  
  console.log('\n结果验证:');
  console.log('  ✓ 驼峰字段存在:', hasCamelCase ? '是' : '否');
  console.log('  ✓ 蛇形字段未暴露:', !hasSnakeCase ? '是' : '否');
  
  if (!hasCamelCase || hasSnakeCase) {
    console.error('❌ 字段映射测试失败!');
    process.exit(1);
  }
  console.log('✅ 字段映射测试通过!\n');

  console.log('=== 测试2: 验证人工修正金额计算 ===\n');
  
  await fetch(`${BASE}/applications/${appId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'PENDING_APPROVAL',
      approver: '审批人',
      approverRole: '财务经理',
      opinion: '审批通过'
    })
  });
  
  await fetch(`${BASE}/applications/${appId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'APPROVED',
      approver: '审批人',
      approverRole: '财务经理',
      opinion: '审批通过'
    })
  });

  await fetch(`${BASE}/applications/${appId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'NEEDS_MANUAL_CORRECTION',
      approver: '系统',
      approverRole: 'SYSTEM',
      opinion: '需要人工修正'
    })
  });

  const correctionResp = await fetch(`${BASE}/applications/${appId}/manual-correction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      totalNewAmount: 2000,
      correctedBy: '修正人员',
      correctionReason: '修正金额',
      impactDetails: [
        {
          itemCode: 'ITEM001',
          itemName: '基础服务费',
          originalAmount: 1000,
          newAmount: 2000,
          remarks: '人工修正后金额'
        }
      ]
    })
  });
  
  const correctionData: any = await correctionResp.json();
  console.log('人工修正后的申请数据:');
  console.log('  - totalOriginalAmount:', correctionData.data.totalOriginalAmount);
  console.log('  - totalNewAmount:', correctionData.data.totalNewAmount);
  console.log('  - totalDifference:', correctionData.data.totalDifference);
  
  const expectedDifference = 2000 - 1000;
  const isDifferenceCorrect = correctionData.data.totalDifference === expectedDifference;
  const isNotZero = correctionData.data.totalDifference !== 0;
  
  console.log('\n结果验证:');
  console.log('  ✓ 差异计算正确 (2000 - 1000 = 1000):', isDifferenceCorrect ? '是' : '否');
  console.log('  ✓ 差异不为0:', isNotZero ? '是' : '否');
  
  if (!isDifferenceCorrect || !isNotZero) {
    console.error('❌ 人工修正金额计算测试失败!');
    process.exit(1);
  }
  console.log('✅ 人工修正金额计算测试通过!\n');

  console.log('=== 测试3: 验证导出字段一致性 ===\n');
  
  const exportResp = await fetch(`${BASE}/export`);
  const exportData: any = await exportResp.json();
  const exportedApp = exportData.data[0];
  
  console.log('导出数据字段验证:');
  console.log('  - id:', exportedApp.id);
  console.log('  - impactDetails[0].itemCode:', exportedApp.impactDetails[0].itemCode);
  console.log('  - impactDetails[0].originalAmount:', exportedApp.impactDetails[0].originalAmount);
  
  const exportHasCorrectFields = 
    exportedApp.id === appId && 
    exportedApp.impactDetails[0].itemCode === 'ITEM001' &&
    exportedApp.impactDetails[0].originalAmount === 1000;
  
  console.log('\n结果验证:');
  console.log('  ✓ 导出字段与主记录一致:', exportHasCorrectFields ? '是' : '否');
  
  if (!exportHasCorrectFields) {
    console.error('❌ 导出字段一致性测试失败!');
    process.exit(1);
  }
  console.log('✅ 导出字段一致性测试通过!\n');

  console.log('🎉 所有测试通过! 两个核心问题已修复:');
  console.log('  1. 影响明细字段映射 (蛇形→驼峰)');
  console.log('  2. 人工修正金额计算 (不再恒为0)');
  console.log('  3. 导出字段与主记录一致性');
}

runTest().catch(console.error);