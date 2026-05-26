const http = require('http');

const baseUrl = 'http://localhost:3000/api/rentals';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('=== 开始 API 测试 ===\n');

  try {
    console.log('1. 测试健康检查...');
    const health = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'GET'
    });
    console.log('   ✓ 健康检查:', health.status);

    console.log('\n2. 测试获取批次列表...');
    const batches = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/rentals/batches',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('   ✓ 批次数量:', batches.data.data ? batches.data.data.length : 0);

    console.log('\n3. 测试搜索租赁记录...');
    const search = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/rentals/search?status=pending',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('   ✓ 待处理记录数:', search.data.count);

    console.log('\n4. 测试按设备序列号查询...');
    const device = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/rentals/device/EQ-2024-002',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('   ✓ 设备 EQ-2024-002 租赁记录:', device.data.data.rentals.length);
    console.log('   ✓ 设备 EQ-2024-002 维修记录:', device.data.data.repairs.length);

    console.log('\n5. 测试获取未解决异常...');
    const exceptions = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/rentals/exceptions/unresolved',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('   ✓ 未解决异常数:', exceptions.data.data ? exceptions.data.data.length : 0);
    if (exceptions.data.data) {
      exceptions.data.data.forEach((ex, i) => {
        console.log(`     ${i + 1}. ${ex.exception_type}: ${ex.description} (¥${ex.amount})`);
      });
    }

    console.log('\n6. 测试获取押金规则...');
    const rules = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/rentals/deposit-rules',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('   ✓ 押金规则数量:', rules.data.data ? rules.data.data.length : 0);

    console.log('\n7. 测试获取操作日志...');
    const logs = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/rentals/operation-logs',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('   ✓ 操作日志数量:', logs.data.data ? logs.data.data.length : 0);

    console.log('\n=== 测试完成 ===');
    console.log('\n提示: 以下接口可以进一步测试:');
    console.log('  - POST /api/rentals/batches - 创建新批次');
    console.log('  - POST /api/rentals/import/rental-csv - 导入租赁CSV');
    console.log('  - POST /api/rentals/:id/process - 标记处理');
    console.log('  - POST /api/rentals/:id/return - 退回修改');
    console.log('  - GET /api/rentals/export - 导出明细');

  } catch (err) {
    console.error('测试失败:', err.message);
    console.log('请确保服务已启动: npm start');
  }
}

runTests();
