const http = require('http');
const { execSync } = require('child_process');

console.log('========================================');
console.log('艺术品寄存库出入库 API - 验收测试');
console.log('========================================\n');

let server;
let testResults = [];

function logTest(name, passed, message = '') {
  const status = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`${status} - ${name}`);
  if (message) {
    console.log(`    ${message}`);
  }
  testResults.push({ name, passed, message });
}

function request(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
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
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
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
  try {
    console.log('步骤 1: 重新初始化数据库...');
    execSync('node scripts/init-db.js', { stdio: 'inherit' });
    console.log('');

    console.log('步骤 2: 启动服务器...');
    server = require('../src/app.js');
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('服务器已启动\n');

    console.log('步骤 3: 创建正常入库单...');
    const normalResult = await request('/api/records', 'POST', {
      record_code: 'TEST001',
      record_type: 'inbound',
      artwork_code: 'AW003',
      store_code: 'ST001',
      handler: '测试员',
      record_date: '2024-05-01',
      remarks: '正常入库测试'
    });
    logTest(
      '正常入库单创建',
      normalResult.status === 200 && normalResult.data.success === true,
      `状态码: ${normalResult.status}, 记录状态: ${normalResult.data.data?.status || 'N/A'}`
    );

    console.log('\n步骤 4: 创建冲突单（高估值无授权出库）...');
    const conflictResult = await request('/api/records', 'POST', {
      record_code: 'TEST002',
      record_type: 'outbound',
      artwork_code: 'AW001',
      store_code: 'ST001',
      handler: '测试员',
      record_date: '2024-05-02',
      remarks: '高估值出库测试 - 无授权',
      register_code: 'REGTEST001'
    });
    
    const hasHighValueWarning = conflictResult.data.warnings &&
      conflictResult.data.warnings.some(w => w.type === 'high_value_without_auth');
    const isPendingStatus = conflictResult.data.data?.status === 'pending';
    
    logTest(
      '高估值无授权出库 - 返回警告',
      conflictResult.status === 200 && hasHighValueWarning,
      `状态码: ${normalResult.status}, 检测到警告: ${hasHighValueWarning ? '是' : '否'}`
    );
    logTest(
      '高估值无授权出库 - 状态为pending',
      isPendingStatus,
      `记录状态: ${conflictResult.data.data?.status || 'N/A'}`
    );

    console.log('\n步骤 5: 创建出入库册不一致场景...');
    const inconsistentResult = await request('/api/records', 'POST', {
      record_code: 'TEST003',
      record_type: 'outbound',
      artwork_code: 'AW004',
      store_code: 'ST001',
      handler: '测试员',
      record_date: '2024-05-03',
      remarks: '出库 - 与入库册冲突',
      register_code: 'REGTEST001'
    });
    
    const hasRegisterWarning = inconsistentResult.data.warnings &&
      inconsistentResult.data.warnings.some(w => w.type === 'register_inconsistency');
    
    logTest(
      '出入库册一致性校验 - 返回警告',
      inconsistentResult.status === 200 && hasRegisterWarning,
      `检测到一致性警告: ${hasRegisterWarning ? '是' : '否'}`
    );

    console.log('\n步骤 6: 验证筛选功能 - 按类型筛选...');
    const filterTypeResult = await request('/api/records?record_type=outbound', 'GET');
    const outboundCount = filterTypeResult.data?.data?.records?.filter(r => r.record_type === 'outbound').length;
    logTest(
      '按类型筛选（出库）',
      filterTypeResult.status === 200 && outboundCount > 0,
      `找到出库记录: ${outboundCount} 条`
    );

    console.log('\n步骤 7: 验证筛选功能 - 按状态筛选...');
    const filterStatusResult = await request('/api/records?status=pending', 'GET');
    const pendingCount = filterStatusResult.data?.data?.records?.filter(r => r.status === 'pending').length;
    logTest(
      '按状态筛选（待处理）',
      filterStatusResult.status === 200 && pendingCount > 0,
      `找到待处理记录: ${pendingCount} 条`
    );

    console.log('\n步骤 8: 验证筛选功能 - 按负责人筛选...');
    const filterHandlerResult = await request('/api/records?handler=测试员', 'GET');
    const handlerCount = filterHandlerResult.data?.data?.records?.filter(r => r.handler.includes('测试员')).length;
    logTest(
      '按负责人筛选（模糊匹配）',
      filterHandlerResult.status === 200 && handlerCount > 0,
      `找到测试员记录: ${handlerCount} 条`
    );

    console.log('\n步骤 9: 验证筛选功能 - 按日期范围筛选...');
    const filterDateResult = await request('/api/records?start_date=2024-05-01&end_date=2024-05-31', 'GET');
    const dateCount = filterDateResult.data?.data?.records?.length || 0;
    logTest(
      '按日期范围筛选',
      filterDateResult.status === 200 && dateCount >= 3,
      `找到指定日期范围内记录: ${dateCount} 条`
    );

    console.log('\n步骤 10: 验证导出功能...');
    const exportResult = await request('/api/records/export?format=json', 'GET');
    logTest(
      'JSON格式导出',
      exportResult.status === 200 && Array.isArray(exportResult.data),
      `导出记录数: ${exportResult.data?.length || 0}`
    );

    console.log('\n步骤 11: 验证修改功能...');
    const updateResult = await request('/api/records/4', 'PUT', {
      status: 'completed',
      remarks: '已补充二次授权',
      has_dual_auth: true,
      auth_by: '测试主管',
      auth_date: '2024-05-04'
    });
    logTest(
      '修改出入库记录',
      updateResult.status === 200 && updateResult.data.success === true,
      `新状态: ${updateResult.data.data?.status || 'N/A'}`
    );

    console.log('\n========================================');
    console.log('测试结果汇总:');
    console.log('========================================');
    const passed = testResults.filter(t => t.passed).length;
    const total = testResults.length;
    console.log(`通过: ${passed}/${total}`);
    
    if (passed === total) {
      console.log('\n🎉 所有测试通过！验收完成！');
    } else {
      console.log('\n⚠️  部分测试未通过，请检查！');
      const failed = testResults.filter(t => !t.passed);
      failed.forEach(f => {
        console.log(`   - ${f.name}: ${f.message}`);
      });
    }
    console.log('');

  } catch (err) {
    console.error('测试执行失败:', err.message);
  } finally {
    process.exit(0);
  }
}

runTests();