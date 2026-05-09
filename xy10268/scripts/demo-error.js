const http = require('./http-client');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForServer() {
  console.log('等待API服务启动...');
  for (let i = 0; i < 30; i++) {
    try {
      const res = await http.get('/health');
      if (res.status === 200) {
        console.log('API服务已就绪！\n');
        return;
      }
    } catch (e) {
    }
    await sleep(1000);
  }
  throw new Error('API服务启动超时，请先运行 npm start');
}

function printStep(title, expectedError, actualResponse) {
  console.log(`\n🚩 ${title}`);
  console.log(`   预期错误: ${expectedError}`);
  console.log(`   实际返回:`);
  if (actualResponse.data && actualResponse.data.error) {
    console.log(`     状态码: ${actualResponse.status}`);
    console.log(`     错误码: ${actualResponse.data.error.code}`);
    console.log(`     错误信息: ${actualResponse.data.error.message}`);
    if (actualResponse.data.error.details) {
      console.log(`     详情: ${JSON.stringify(actualResponse.data.error.details)}`);
    }
  } else {
    console.log('     ' + JSON.stringify(actualResponse.data, null, 2).split('\n').join('\n     '));
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('中药代煎包裹核验API - 异常触发路径演示');
  console.log('='.repeat(70));
  console.log('');
  console.log('演示场景：');
  console.log('  1. 缺字段校验');
  console.log('  2. 重复提交（唯一约束）');
  console.log('  3. 非法流转（状态机约束）');
  console.log('  4. 错包核验（处方不匹配）');
  console.log('  5. 错包隔离');
  console.log('  6. 人工修正 + 历史追溯');
  console.log('  7. 处方撤回后禁止创建批次');
  console.log('');

  await waitForServer();

  const operator = '药师-王五';

  console.log('\n' + '━'.repeat(70));
  console.log('【前置准备】创建两张处方和一个包裹');
  console.log('━'.repeat(70));

  const pres1Res = await http.post('/api/prescriptions', {
    patient_name: '李四',
    patient_id: 'P002',
    medicines: [{ name: '人参', amount: '10g' }],
    operator
  });
  const pres1 = pres1Res.data.data;
  console.log(`✅ 处方1(李四)创建成功: ${pres1.id.substring(0, 8)}...`);

  const pres2Res = await http.post('/api/prescriptions', {
    patient_name: '王五',
    patient_id: 'P003',
    medicines: [{ name: '鹿茸', amount: '5g' }],
    operator
  });
  const pres2 = pres2Res.data.data;
  console.log(`✅ 处方2(王五)创建成功: ${pres2.id.substring(0, 8)}...`);

  console.log('\n' + '━'.repeat(70));
  console.log('场景 1/7: 缺字段校验 - 创建处方缺少 patient_name');
  console.log('━'.repeat(70));
  const missingFieldRes = await http.post('/api/prescriptions', {
    patient_id: 'P004',
    medicines: [{ name: '当归', amount: '10g' }]
  });
  printStep(
    '缺字段校验触发',
    '缺少必填字段: patient_name',
    missingFieldRes
  );

  console.log('\n' + '━'.repeat(70));
  console.log('场景 2/7: 重复提交 - 创建相同编码的包裹');
  console.log('━'.repeat(70));
  await http.post('/api/packages', { package_code: 'PKG-ERROR-001', operator });
  console.log('✅ 第一次创建包裹成功');
  const duplicateRes = await http.post('/api/packages', { package_code: 'PKG-ERROR-001', operator });
  printStep(
    '重复提交触发',
    '包裹编码已存在（重复提交）',
    duplicateRes
  );

  console.log('\n' + '━'.repeat(70));
  console.log('场景 3/7: 非法流转 - 直接完成未开始的煎煮批次');
  console.log('━'.repeat(70));
  const batchRes = await http.post('/api/batches', {
    batch_code: 'BATCH-ERROR-001',
    prescription_id: pres1.id,
    operator
  });
  const batch = batchRes.data.data;
  console.log(`✅ 煎煮批次创建成功，当前状态: ${batch.status}`);
  
  const illegalFlowRes = await http.post(`/api/batches/${batch.id}/complete`, { operator });
  printStep(
    '非法流转触发（created → completed 跳过 cooking）',
    '非法流转：当前状态(created)无法完成煎煮',
    illegalFlowRes
  );

  console.log('\n' + '━'.repeat(70));
  console.log('【继续前置】正常完成一个煎煮流程');
  console.log('━'.repeat(70));
  await http.post(`/api/batches/${batch.id}/start`, { operator });
  await http.post(`/api/batches/${batch.id}/complete`, { operator });
  console.log('✅ 煎煮批次已完成（created → cooking → completed）');

  console.log('\n' + '━'.repeat(70));
  console.log('场景 4/7: 错包核验 - 包裹绑定处方1，扫处方2的条码');
  console.log('━'.repeat(70));
  const pkgRes = await http.post('/api/packages', { package_code: 'PKG-ERROR-002', operator });
  const pkg = pkgRes.data.data;
  
  await http.post(`/api/packages/${pkg.id}/bind`, { batch_id: batch.id, operator });
  console.log(`✅ 包裹绑定批次成功，关联处方1(李四)`);
  
  const mismatchRes = await http.post(`/api/packages/${pkg.id}/verify`, {
    prescription_id: pres2.id,
    operator: '配送员-赵六'
  });
  console.log(`\n🚩 错包核验触发（包裹绑定处方1，扫描处方2）`);
  console.log(`   核验结果:`);
  console.log(`     verify_result: ${mismatchRes.data.data.verify_result}`);
  console.log(`     预期处方ID: ${mismatchRes.data.data.expected_prescription_id.substring(0, 8)}...`);
  console.log(`     扫描处方ID: ${mismatchRes.data.data.scanned_prescription_id.substring(0, 8)}...`);
  console.log(`     包裹状态: ${mismatchRes.data.data.status}`);
  console.log(`     提示: ${mismatchRes.data.data.message}`);

  console.log('\n' + '━'.repeat(70));
  console.log('场景 5/7: 错包隔离 - 核验错误的包裹进行隔离');
  console.log('━'.repeat(70));
  const isolateRes = await http.post(`/api/packages/${pkg.id}/isolate`, {
    operator: '质控员-钱七',
    reason: '疑似错发，需要人工复核'
  });
  printStep(
    '错包隔离成功',
    '包裹已隔离',
    isolateRes
  );

  console.log('\n' + '━'.repeat(70));
  console.log('场景 6/7: 人工修正 + 历史追溯');
  console.log('━'.repeat(70));
  
  const pres3Res = await http.post('/api/prescriptions', {
    patient_name: '孙八',
    patient_id: 'P004',
    medicines: [{ name: '白术', amount: '15g' }],
    operator
  });
  const pres3 = pres3Res.data.data;
  
  const batch2Res = await http.post('/api/batches', {
    batch_code: 'BATCH-ERROR-002',
    prescription_id: pres3.id,
    operator
  });
  const batch2 = batch2Res.data.data;
  await http.post(`/api/batches/${batch2.id}/start`, { operator });
  await http.post(`/api/batches/${batch2.id}/complete`, { operator });
  
  const pkg2Res = await http.post('/api/packages', { package_code: 'PKG-ERROR-003', operator });
  const pkg2 = pkg2Res.data.data;
  
  console.log('✅ 先错误绑定到第一个批次（处方1）');
  await http.post(`/api/packages/${pkg2.id}/bind`, { batch_id: batch.id, operator });
  
  console.log('\n🚩 人工修正：重新绑定到正确批次（处方3）');
  const rebindRes = await http.put(`/api/packages/${pkg2.id}`, {
    prescription_id: pres3.id,
    batch_id: batch2.id,
    operator: '管理员-周九'
  });
  console.log(`   修正后状态:`);
  console.log(`     批次ID: ${rebindRes.data.data.batch_id.substring(0, 8)}...`);
  console.log(`     处方ID: ${rebindRes.data.data.prescription_id.substring(0, 8)}...`);

  console.log('\n📜 查看历史记录（前后变化）:');
  const historyRes = await http.get(`/api/packages/${pkg2.id}/history`);
  const history = historyRes.data.data;
  history.forEach((h, idx) => {
    console.log(`\n   [${idx + 1}] ${h.action} - ${h.operator}`);
    if (h.before_data) {
      console.log(`       变更前: batch=${h.before_data.batch_id?.substring(0, 8) || 'null'}..., prescription=${h.before_data.prescription_id?.substring(0, 8) || 'null'}...`);
    }
    console.log(`       变更后: batch=${h.after_data.batch_id?.substring(0, 8) || 'null'}..., prescription=${h.after_data.prescription_id?.substring(0, 8) || 'null'}...`);
  });

  console.log('\n' + '━'.repeat(70));
  console.log('场景 7/7: 处方撤回后禁止创建批次');
  console.log('━'.repeat(70));
  const pres4Res = await http.post('/api/prescriptions', {
    patient_name: '吴十',
    patient_id: 'P005',
    medicines: [{ name: '茯苓', amount: '20g' }],
    operator
  });
  const pres4 = pres4Res.data.data;
  
  await http.post(`/api/prescriptions/${pres4.id}/withdraw`, {
    operator,
    reason: '患者取消就诊'
  });
  console.log(`✅ 处方已撤回，当前状态: withdrawn`);
  
  const withdrawnRes = await http.post('/api/batches', {
    batch_code: 'BATCH-ERROR-003',
    prescription_id: pres4.id,
    operator
  });
  printStep(
    '处方已撤回，无法创建煎煮批次',
    '处方已撤回，无法创建煎煮批次',
    withdrawnRes
  );

  console.log('\n' + '='.repeat(70));
  console.log('异常触发路径演示完成！');
  console.log('='.repeat(70));
  console.log('');
  console.log('已复现的接口场景:');
  console.log('  ✅ 缺字段校验');
  console.log('  ✅ 重复提交（唯一约束）');
  console.log('  ✅ 非法流转（状态机约束）');
  console.log('  ✅ 错包核验（处方不匹配）');
  console.log('  ✅ 错包隔离');
  console.log('  ✅ 人工修正 + 历史追溯');
  console.log('  ✅ 处方撤回后禁止创建批次');
}

main().catch(console.error);
