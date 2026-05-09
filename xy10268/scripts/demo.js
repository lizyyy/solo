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

function printStep(title, content, isSuccess = true) {
  const icon = isSuccess ? '✅' : '❌';
  console.log(`\n${icon} ${title}`);
  if (content) {
    console.log('   ' + JSON.stringify(content, null, 2).split('\n').join('\n   '));
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('中药代煎包裹核验API - 最短演示路径（正常流程）');
  console.log('='.repeat(70));
  console.log('');
  console.log('流程：创建处方 → 创建煎煮批次 → 开始煎煮 → 完成煎煮 → ');
  console.log('      创建包裹 → 绑定批次 → 扫码核验 → 查看历史记录');
  console.log('');

  await waitForServer();

  const operator = '药师-张三';

  console.log('\n' + '─'.repeat(70));
  console.log('步骤 1/8: 创建处方（患者：张三）');
  console.log('─'.repeat(70));
  const presRes = await http.post('/api/prescriptions', {
    patient_name: '张三',
    patient_id: 'P001',
    medicines: [
      { name: '当归', amount: '10g' },
      { name: '黄芪', amount: '15g' },
      { name: '甘草', amount: '5g' }
    ],
    operator
  });
  const prescription = presRes.data.data;
  printStep('处方创建成功', {
    id: prescription.id.substring(0, 8) + '...',
    patient_name: prescription.patient_name,
    status: prescription.status
  });

  console.log('\n' + '─'.repeat(70));
  console.log('步骤 2/8: 创建煎煮批次，绑定处方');
  console.log('─'.repeat(70));
  const batchRes = await http.post('/api/batches', {
    batch_code: 'BATCH-20260510-001',
    prescription_id: prescription.id,
    operator
  });
  const batch = batchRes.data.data;
  printStep('煎煮批次创建成功', {
    id: batch.id.substring(0, 8) + '...',
    batch_code: batch.batch_code,
    status: batch.status
  });

  console.log('\n' + '─'.repeat(70));
  console.log('步骤 3/8: 开始煎煮（状态流转：created → cooking）');
  console.log('─'.repeat(70));
  const startRes = await http.post(`/api/batches/${batch.id}/start`, { operator });
  printStep('煎煮已开始', {
    status: startRes.data.data.status,
    start_time: startRes.data.data.start_time
  });

  console.log('\n' + '─'.repeat(70));
  console.log('步骤 4/8: 完成煎煮（状态流转：cooking → completed）');
  console.log('─'.repeat(70));
  const completeRes = await http.post(`/api/batches/${batch.id}/complete`, { operator });
  printStep('煎煮已完成', {
    status: completeRes.data.data.status,
    end_time: completeRes.data.data.end_time
  });

  console.log('\n' + '─'.repeat(70));
  console.log('步骤 5/8: 创建配送包裹');
  console.log('─'.repeat(70));
  const pkgRes = await http.post('/api/packages', {
    package_code: 'PKG-20260510-001',
    operator
  });
  const pkg = pkgRes.data.data;
  printStep('包裹创建成功', {
    id: pkg.id.substring(0, 8) + '...',
    package_code: pkg.package_code,
    status: pkg.status
  });

  console.log('\n' + '─'.repeat(70));
  console.log('步骤 6/8: 包裹绑定煎煮批次');
  console.log('─'.repeat(70));
  const bindRes = await http.post(`/api/packages/${pkg.id}/bind`, {
    batch_id: batch.id,
    operator
  });
  printStep('包裹绑定成功', {
    status: bindRes.data.data.status,
    batch_id: bindRes.data.data.batch_id.substring(0, 8) + '...',
    prescription_id: bindRes.data.data.prescription_id.substring(0, 8) + '...'
  });

  console.log('\n' + '─'.repeat(70));
  console.log('步骤 7/8: 核验包裹（模拟扫处方条码，输入处方ID）');
  console.log('─'.repeat(70));
  console.log('   核验逻辑：比对 package.prescription_id vs 扫码得到的 prescription_id');
  console.log('');
  const verifyRes = await http.post(`/api/packages/${pkg.id}/verify`, {
    prescription_id: prescription.id,
    operator: '配送员-李四'
  });
  const verifyData = verifyRes.data.data;
  printStep(`核验结果：${verifyData.verify_result === 'match' ? '通过 ✓' : '不通过 ✗'}`, {
    verify_result: verifyData.verify_result,
    message: verifyData.message,
    status: verifyData.status
  });

  console.log('\n' + '─'.repeat(70));
  console.log('步骤 8/8: 查看包裹历史记录（变更追溯）');
  console.log('─'.repeat(70));
  const historyRes = await http.get(`/api/packages/${pkg.id}/history`);
  const history = historyRes.data.data;
  printStep('包裹历史记录（按时间顺序）', null);
  history.forEach((h, idx) => {
    console.log(`   [${idx + 1}] ${h.created_at}`);
    console.log(`       操作: ${h.action}`);
    console.log(`       操作人: ${h.operator}`);
    if (h.before_data) {
      console.log(`       变更前状态: ${h.before_data.status}`);
    }
    console.log(`       变更后状态: ${h.after_data.status}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('最短演示路径完成！');
  console.log('='.repeat(70));
  console.log('');
  console.log('可复现的异常场景请运行: npm run demo-error');
  console.log('包含：非法流转、缺字段、重复提交、错包核验、人工修正等');
}

main().catch(console.error);
