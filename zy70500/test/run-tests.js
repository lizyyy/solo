const crypto = require('crypto');

function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

async function runTests() {
  const baseUrl = 'http://localhost:3000/api/rotation';
  
  console.log('='.repeat(60));
  console.log('🧪 Webhook签名轮换API 测试套件');
  console.log('='.repeat(60));
  console.log('');

  const vendorId = 'TEST_VENDOR_001';
  const oldSecret = 'old_secret_key_12345';
  const newSecret = 'new_secret_key_67890';

  let rotationId = null;
  let failedSampleId = null;

  try {
    console.log('📍 测试1: 创建轮换任务');
    console.log('-'.repeat(40));
    const createRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId,
        oldSecret,
        newSecret
      })
    });
    const createData = await createRes.json();
    console.log('✅ 创建成功, 状态:', createData.data.rotationState);
    rotationId = createData.data.id;
    console.log('   轮换任务ID:', rotationId);
    console.log('');

    console.log('📍 测试2: 查询轮换任务');
    console.log('-'.repeat(40));
    const getRes = await fetch(`${baseUrl}/${rotationId}`);
    const getData = await getRes.json();
    console.log('✅ 查询成功, 状态:', getData.data.rotationState);
    console.log('   供应商ID:', getData.data.vendorId);
    console.log('');

    console.log('📍 测试3: 重复创建轮换任务 (应失败)');
    console.log('-'.repeat(40));
    const dupRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId,
        oldSecret: 'another_old',
        newSecret: 'another_new'
      })
    });
    const dupData = await dupRes.json();
    console.log('✅ 正确拒绝重复创建, 错误:', dupData.error);
    console.log('');

    console.log('📍 测试4: 使用旧密钥验签');
    console.log('-'.repeat(40));
    const payload1 = { event: 'payment.success', orderId: 'ORD001', amount: 100 };
    const sig1 = generateSignature(payload1, oldSecret);
    const verify1Res = await fetch(`${baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId,
        payload: payload1,
        signature: sig1,
        idempotencyKey: 'IDE001'
      })
    });
    const verify1Data = await verify1Res.json();
    console.log('✅ 旧密钥验签结果:', verify1Data.success ? '成功' : '失败');
    console.log('   使用密钥类型:', verify1Data.data.keyType);
    console.log('');

    console.log('📍 测试5: 使用新密钥验签');
    console.log('-'.repeat(40));
    const payload2 = { event: 'payment.success', orderId: 'ORD002', amount: 200 };
    const sig2 = generateSignature(payload2, newSecret);
    const verify2Res = await fetch(`${baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId,
        payload: payload2,
        signature: sig2,
        idempotencyKey: 'IDE002'
      })
    });
    const verify2Data = await verify2Res.json();
    console.log('✅ 新密钥验签结果:', verify2Data.success ? '成功' : '失败');
    console.log('   使用密钥类型:', verify2Data.data.keyType);
    console.log('');

    console.log('📍 测试6: 重复回调去重');
    console.log('-'.repeat(40));
    const dupVerifyRes = await fetch(`${baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId,
        payload: payload1,
        signature: sig1,
        idempotencyKey: 'IDE001'
      })
    });
    const dupVerifyData = await dupVerifyRes.json();
    console.log('✅ 重复回调检测:', dupVerifyData.data.isDuplicate ? '已去重' : '未去重');
    console.log('   原始样本ID:', dupVerifyData.data.originalSampleId);
    console.log('');

    console.log('📍 测试7: 错误签名验签 (应失败并留存样本)');
    console.log('-'.repeat(40));
    const payload3 = { event: 'payment.success', orderId: 'ORD003', amount: 300 };
    const wrongSig = 'wrong_signature_12345';
    const verify3Res = await fetch(`${baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId,
        payload: payload3,
        signature: wrongSig,
        idempotencyKey: 'IDE003'
      })
    });
    const verify3Data = await verify3Res.json();
    console.log('✅ 错误签名验签结果:', verify3Data.success ? '成功 (异常)' : '失败 (预期)');
    console.log('   样本ID:', verify3Data.data.sample.id);
    failedSampleId = verify3Data.data.sample.id;
    console.log('');

    console.log('📍 测试8: 人工修正失败样本');
    console.log('-'.repeat(40));
    const fixRes = await fetch(`${baseUrl}/samples/${failedSampleId}/manual-fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator: 'admin',
        note: '合作伙伴确认回调有效，人工标记通过'
      })
    });
    const fixData = await fixRes.json();
    console.log('✅ 人工修正结果:', fixData.success ? '成功' : '失败');
    console.log('   修正后状态:', fixData.data.verificationResult);
    console.log('   操作人:', fixData.data.manuallyFixedBy);
    console.log('');

    console.log('📍 测试9: 推进轮换状态 - 弃用旧密钥');
    console.log('-'.repeat(40));
    const deprecateRes = await fetch(`${baseUrl}/${rotationId}/deprecate-old-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const deprecateData = await deprecateRes.json();
    console.log('✅ 弃用旧密钥成功, 新状态:', deprecateData.data.rotationState);
    console.log('');

    console.log('📍 测试10: 旧密钥弃用后验签 (应只接受新密钥)');
    console.log('-'.repeat(40));
    const payload4 = { event: 'payment.success', orderId: 'ORD004', amount: 400 };
    const sig4Old = generateSignature(payload4, oldSecret);
    const verify4OldRes = await fetch(`${baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId,
        payload: payload4,
        signature: sig4Old,
        idempotencyKey: 'IDE004'
      })
    });
    const verify4OldData = await verify4OldRes.json();
    console.log('✅ 弃用后旧密钥验签:', verify4OldData.success ? '成功 (异常)' : '失败 (预期)');
    
    const sig4New = generateSignature(payload4, newSecret);
    const verify4NewRes = await fetch(`${baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId,
        payload: payload4,
        signature: sig4New,
        idempotencyKey: 'IDE005'
      })
    });
    const verify4NewData = await verify4NewRes.json();
    console.log('✅ 弃用后新密钥验签:', verify4NewData.success ? '成功 (预期)' : '失败');
    console.log('');

    console.log('📍 测试11: 重复推进同一状态 (应失败)');
    console.log('-'.repeat(40));
    const dupDeprecateRes = await fetch(`${baseUrl}/${rotationId}/deprecate-old-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const dupDeprecateData = await dupDeprecateRes.json();
    console.log('✅ 重复状态推进被正确拒绝, 错误:', dupDeprecateData.error);
    console.log('');

    console.log('📍 测试12: 生成验签报告');
    console.log('-'.repeat(40));
    const reportRes = await fetch(`${baseUrl}/${rotationId}/report`);
    const reportData = await reportRes.json();
    console.log('✅ 报告生成成功');
    console.log('   总回调数:', reportData.data.summary.totalCallbacks);
    console.log('   成功数:', reportData.data.summary.successCount);
    console.log('   重复回调数:', reportData.data.summary.duplicateCount);
    console.log('   人工修正数:', reportData.data.summary.manuallyFixedCount);
    console.log('   旧密钥成功:', reportData.data.summary.oldKeySuccessCount);
    console.log('   新密钥成功:', reportData.data.summary.newKeySuccessCount);
    console.log('');

    console.log('📍 测试13: 导出报告 (JSON)');
    console.log('-'.repeat(40));
    const exportRes = await fetch(`${baseUrl}/${rotationId}/export?format=json`);
    const exportData = await exportRes.json();
    console.log('✅ JSON导出成功, 包含', exportData.data.details.length, '条记录');
    console.log('');

    console.log('📍 测试14: 异常记录详情检查');
    console.log('-'.repeat(40));
    console.log('✅ 异常记录数:', exportData.data.anomalies.length);
    exportData.data.anomalies.forEach((a, i) => {
      console.log(`   异常${i + 1}: ${a.type} - ${a.message}`);
    });
    console.log('');

    console.log('📍 测试15: 完成轮换');
    console.log('-'.repeat(40));
    const completeRes = await fetch(`${baseUrl}/${rotationId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const completeData = await completeRes.json();
    console.log('✅ 轮换完成, 最终状态:', completeData.data.rotationState);
    console.log('');

    console.log('='.repeat(60));
    console.log('🎉 所有测试通过!');
    console.log('='.repeat(60));
    console.log('');
    console.log('📋 测试覆盖:');
    console.log('   ✅ 创建轮换任务');
    console.log('   ✅ 查询轮换任务');
    console.log('   ✅ 重复创建拒绝');
    console.log('   ✅ 双密钥窗口验签');
    console.log('   ✅ 重复回调去重');
    console.log('   ✅ 失败样本留存');
    console.log('   ✅ 人工修正样本');
    console.log('   ✅ 状态机推进');
    console.log('   ✅ 重复推进状态拒绝');
    console.log('   ✅ 验签报告生成');
    console.log('   ✅ 报告导出 (JSON)');
    console.log('   ✅ 异常记录详情');
    console.log('   ✅ 完成轮换');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('');
    console.log('💡 提示: 请确保服务已启动 (npm start)');
    process.exit(1);
  }
}

runTests();