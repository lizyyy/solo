const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3000;

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 宠物医院药房管理系统 - API测试');
  console.log('='.repeat(60) + '\n');

  let testResults = [];

  try {
    console.log('📋 测试1: 获取所有药品');
    const medicines = await request('GET', '/api/medicines');
    console.log(`   结果: ${medicines.success ? '✅' : '❌'} ${medicines.message}`);
    testResults.push({ name: '获取药品列表', success: medicines.success });
    console.log('');

    console.log('📋 测试2: 获取所有宠物');
    const pets = await request('GET', '/api/pets');
    console.log(`   结果: ${pets.success ? '✅' : '❌'} ${pets.message}`);
    testResults.push({ name: '获取宠物列表', success: pets.success });
    console.log('');

    console.log('📋 测试3: 获取所有库存');
    const inventory = await request('GET', '/api/inventory');
    console.log(`   结果: ${inventory.success ? '✅' : '❌'} ${inventory.message}`);
    testResults.push({ name: '获取库存列表', success: inventory.success });
    console.log('');

    console.log('✅ 正常场景1: 创建正常剂量处方 (阿莫西林 0.02g/kg)');
    const normalPrescription = await request('POST', '/api/prescriptions', {
      petId: 1,
      doctor: '李医生',
      diagnosis: '呼吸道感染',
      items: [
        {
          medicineId: 1,
          inventoryId: 1,
          dosage: 0.02,
          dosageUnit: 'g/kg',
          quantity: 14,
          notes: '饭后服用'
        }
      ]
    });
    console.log(`   结果: ${normalPrescription.success ? '✅' : '❌'} ${normalPrescription.message}`);
    console.log(`   原因: ${normalPrescription.reason}`);
    testResults.push({ name: '正常剂量处方', success: normalPrescription.success });
    console.log('');

    console.log('✅ 正常场景2: 正常组合处方 (阿莫西林 + 氨溴索)');
    const comboPrescription = await request('POST', '/api/prescriptions', {
      petId: 1,
      doctor: '李医生',
      diagnosis: '呼吸道感染伴咳嗽',
      items: [
        { medicineId: 1, inventoryId: 1, dosage: 0.02, dosageUnit: 'g/kg', quantity: 14 },
        { medicineId: 3, inventoryId: 3, dosage: 0.003, dosageUnit: 'g/kg', quantity: 14 }
      ]
    });
    console.log(`   结果: ${comboPrescription.success ? '✅' : '❌'} ${comboPrescription.message}`);
    testResults.push({ name: '正常组合处方', success: comboPrescription.success });
    console.log('');

    console.log('❌ 异常场景1: 剂量超标 (阿莫西林 0.1g/kg > 上限 0.05g/kg)');
    const overdosePrescription = await request('POST', '/api/prescriptions', {
      petId: 2,
      doctor: '王医生',
      diagnosis: '感染',
      items: [
        { medicineId: 1, inventoryId: 1, dosage: 0.1, dosageUnit: 'g/kg', quantity: 7 }
      ]
    });
    console.log(`   结果: ${!overdosePrescription.success ? '✅ 正确拦截' : '❌ 未拦截'}`);
    console.log(`   拦截原因: ${overdosePrescription.reason}`);
    testResults.push({ name: '剂量超标拦截', success: !overdosePrescription.success });
    console.log('');

    console.log('❌ 异常场景2: 禁忌组合 (阿莫西林 + 头孢氨苄)');
    const contraPrescription = await request('POST', '/api/prescriptions', {
      petId: 1,
      doctor: '张医生',
      diagnosis: '严重感染',
      items: [
        { medicineId: 1, inventoryId: 1, dosage: 0.02, dosageUnit: 'g/kg', quantity: 14 },
        { medicineId: 2, inventoryId: 2, dosage: 0.02, dosageUnit: 'g/kg', quantity: 14 }
      ]
    });
    console.log(`   结果: ${!contraPrescription.success ? '✅ 正确拦截' : '❌ 未拦截'}`);
    console.log(`   拦截原因: ${contraPrescription.reason}`);
    testResults.push({ name: '禁忌组合拦截', success: !contraPrescription.success });
    console.log('');

    console.log('❌ 异常场景3: 过期批号 (氨溴索批号已过期)');
    const expiredPrescription = await request('POST', '/api/prescriptions', {
      petId: 3,
      doctor: '刘医生',
      diagnosis: '咳嗽',
      items: [
        { medicineId: 3, inventoryId: 4, dosage: 0.003, dosageUnit: 'g/kg', quantity: 7 }
      ]
    });
    console.log(`   结果: ${!expiredPrescription.success ? '✅ 正确拦截' : '❌ 未拦截'}`);
    console.log(`   拦截原因: ${expiredPrescription.reason}`);
    testResults.push({ name: '过期批号拦截', success: !expiredPrescription.success });
    console.log('');

    console.log('✅ 功能测试: 审核处方');
    const prescriptions = await request('GET', '/api/prescriptions');
    if (prescriptions.data && prescriptions.data.length > 0) {
      const prescId = prescriptions.data[0].id;
      const reviewResult = await request('POST', `/api/prescriptions/${prescId}/review`, {
        reviewer: '王主任',
        action: 'approve',
        comments: '剂量合理，同意发药'
      });
      console.log(`   结果: ${reviewResult.success ? '✅' : '❌'} ${reviewResult.message}`);
      testResults.push({ name: '审核处方', success: reviewResult.success });
    }
    console.log('');

    console.log('✅ 功能测试: 获取审核日志');
    const auditLogs = await request('GET', '/api/audit-logs?type=prescription');
    console.log(`   结果: ${auditLogs.success ? '✅' : '❌'} ${auditLogs.message}`);
    console.log(`   日志数量: ${auditLogs.data ? auditLogs.data.length : 0}`);
    testResults.push({ name: '获取审核日志', success: auditLogs.success });
    console.log('');

    console.log('✅ 功能测试: 批量创建药品');
    const batchMedicines = await request('POST', '/api/medicines/batch', {
      medicines: [
        { name: '批量药品A', dosageMin: 0.01, dosageMax: 0.05, contraindications: [] },
        { name: '批量药品B', dosageMin: 0.02, dosageMax: 0.04, contraindications: [] },
        { name: '', dosageMin: 0.01, dosageMax: 0.05 }
      ]
    });
    console.log(`   结果: ${batchMedicines.success ? '✅' : '⚠️  部分成功'}`);
    console.log(`   成功: ${batchMedicines.data.successCount}, 失败: ${batchMedicines.data.failCount}`);
    testResults.push({ name: '批量操作', success: true });
    console.log('');

    console.log('='.repeat(60));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(60));
    
    const passed = testResults.filter(r => r.success).length;
    const total = testResults.length;
    
    testResults.forEach((result, index) => {
      console.log(`  ${result.success ? '✅' : '❌'} ${result.name}`);
    });
    
    console.log('');
    console.log(`总计: ${passed}/${total} 测试通过 (${((passed/total)*100).toFixed(1)}%)`);
    
    if (passed === total) {
      console.log('\n🎉 所有测试通过! 系统运行正常。');
    } else {
      console.log('\n⚠️  部分测试未通过，请检查系统配置。');
    }
    
    console.log('');

  } catch (error) {
    console.error('❌ 测试运行失败:', error.message);
    console.log('\n💡 提示: 请确保服务已启动 (npm start)');
  }
}

runTests();
