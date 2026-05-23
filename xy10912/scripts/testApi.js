const http = require('http');

const BASE_URL = 'http://localhost:3000/api';
let passed = 0;
let failed = 0;

function request(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
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
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
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

function test(name, fn) {
  console.log(`\n🔍 测试: ${name}`);
  return fn()
    .then(() => {
      console.log(`   ✅ 通过`);
      passed++;
    })
    .catch((err) => {
      console.log(`   ❌ 失败: ${err.message}`);
      failed++;
    });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('连锁门店价签 API 测试套件');
  console.log('='.repeat(60));

  await test('健康检查接口', async () => {
    const res = await request('/health');
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`期望状态200且success=true，实际: ${res.status}`);
    }
  });

  await test('API根路径', async () => {
    const res = await request('/');
    if (res.status !== 200) {
      throw new Error(`期望状态200，实际: ${res.status}`);
    }
  });

  await test('获取门店列表', async () => {
    const res = await request('/stores');
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`获取门店失败: ${res.data.message}`);
    }
  });

  await test('获取商品列表', async () => {
    const res = await request('/products');
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`获取商品失败: ${res.data.message}`);
    }
  });

  await test('获取价签版本列表', async () => {
    const res = await request('/price-versions');
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`获取价签版本失败: ${res.data.message}`);
    }
  });

  await test('获取促销列表', async () => {
    const res = await request('/promotions');
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`获取促销失败: ${res.data.message}`);
    }
  });

  await test('获取确认记录列表', async () => {
    const res = await request('/confirmations');
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`获取确认记录失败: ${res.data.message}`);
    }
  });

  await test('获取差异报告列表', async () => {
    const res = await request('/discrepancies');
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`获取差异报告失败: ${res.data.message}`);
    }
  });

  await test('获取待复核差异', async () => {
    const res = await request('/discrepancies/pending-review');
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`获取待复核差异失败: ${res.data.message}`);
    }
  });

  await test('获取异常日志列表', async () => {
    const res = await request('/exceptions');
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`获取异常日志失败: ${res.data.message}`);
    }
  });

  await test('获取人工修正列表', async () => {
    const res = await request('/corrections');
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`获取人工修正失败: ${res.data.message}`);
    }
  });

  await test('获取汇总报告', async () => {
    const res = await request('/exports/report/summary');
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`获取汇总报告失败: ${res.data.message}`);
    }
  });

  await test('创建门店', async () => {
    const res = await request('/stores', 'POST', {
      store_code: `TEST${Date.now()}`,
      store_name: '测试门店',
      address: '测试地址',
      manager: '测试员',
      phone: '13800000000',
      status: 'active'
    });
    if (res.status !== 201 || !res.data.success) {
      throw new Error(`创建门店失败: ${res.data.message}`);
    }
  });

  await test('创建商品', async () => {
    const res = await request('/products', 'POST', {
      barcode: `TEST${Date.now()}`,
      product_name: '测试商品',
      category: '测试',
      base_price: 10.00,
      unit: '件'
    });
    if (res.status !== 201 || !res.data.success) {
      throw new Error(`创建商品失败: ${res.data.message}`);
    }
  });

  await test('404处理', async () => {
    const res = await request('/nonexistent');
    if (res.status !== 404) {
      throw new Error(`期望404，实际: ${res.status}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📊 通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed > 0) {
    process.exit(1);
  }
}

console.log('请确保服务已启动 (npm start)');
console.log('等待服务连接...\n');

setTimeout(() => {
  runTests().catch((err) => {
    console.error('\n测试执行失败:', err.message);
    console.log('\n请确保:');
    console.log('  1. 已安装依赖: npm install');
    console.log('  2. 服务已启动: npm start');
    console.log('  3. 服务运行在端口3000');
    process.exit(1);
  });
}, 1000);
