const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            data: data ? JSON.parse(data) : null
          };
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`HTTP Error: ${res.statusCode} - ${data}`));
          }
        } catch (e) {
          reject(new Error(`Parse Error: ${e.message} - Data: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('========================================');
  console.log('  血袋样本配对验收台 - 集成测试');
  console.log('========================================\n');

  let testResults = [];
  let passCount = 0;
  let failCount = 0;

  function test(name, fn) {
    return async () => {
      try {
        console.log(`测试: ${name}`);
        await fn();
        console.log(`  ✓ 通过\n`);
        testResults.push({ name, status: 'PASS' });
        passCount++;
      } catch (error) {
        console.log(`  ✗ 失败: ${error.message}\n`);
        testResults.push({ name, status: 'FAIL', error: error.message });
        failCount++;
      }
    };
  }

  await test('健康检查', async () => {
    const response = await makeRequest('/health');
    if (!response.data || response.data.status !== 'ok') {
      throw new Error('健康检查失败');
    }
  })();

  const donorCode = `TEST_D_${Date.now()}`;
  const bagCode = `TEST_B_${Date.now()}`;
  const tubeCode = `TEST_T_${Date.now()}`;

  await test('创建献血者', async () => {
    const response = await makeRequest('/donors', {
      method: 'POST',
      body: {
        donor_code: donorCode,
        name: '测试献血者',
        blood_type: 'A',
        operator: 'test'
      }
    });
    if (!response.data) {
      throw new Error('创建献血者失败');
    }
  })();

  await test('获取献血者列表', async () => {
    const response = await makeRequest('/donors');
    if (!Array.isArray(response.data)) {
      throw new Error('获取献血者列表失败');
    }
  })();

  await test('创建血袋', async () => {
    const response = await makeRequest('/blood-bags', {
      method: 'POST',
      body: {
        bag_code: bagCode,
        donor_code: donorCode,
        volume: 400,
        blood_type: 'A',
        operator: 'test'
      }
    });
    if (!response.data) {
      throw new Error('创建血袋失败');
    }
  })();

  await test('创建样本管', async () => {
    const response = await makeRequest('/sample-tubes', {
      method: 'POST',
      body: {
        tube_code: tubeCode,
        donor_code: donorCode,
        tube_type: 'standard',
        operator: 'test'
      }
    });
    if (!response.data) {
      throw new Error('创建样本管失败');
    }
  })();

  await test('创建冷箱', async () => {
    const boxCode = `TEST_BOX_${Date.now()}`;
    const response = await makeRequest('/cold-boxes', {
      method: 'POST',
      body: {
        box_code: boxCode,
        description: '测试冷箱',
        max_temp: 10,
        operator: 'test'
      }
    });
    if (!response.data) {
      throw new Error('创建冷箱失败');
    }
  })();

  await test('验证配对', async () => {
    const response = await makeRequest('/matches/validate', {
      method: 'POST',
      body: {
        blood_bag_code: bagCode,
        sample_tube_code: tubeCode
      }
    });
    if (typeof response.data.valid === 'undefined') {
      throw new Error('验证配对失败');
    }
  })();

  await test('创建配对', async () => {
    const response = await makeRequest('/matches', {
      method: 'POST',
      body: {
        blood_bag_code: bagCode,
        sample_tube_code: tubeCode,
        operator: 'test'
      }
    });
    if (!response.data) {
      throw new Error('创建配对失败');
    }
  })();

  await test('获取审计日志', async () => {
    const response = await makeRequest('/audit-logs');
    if (!Array.isArray(response.data)) {
      throw new Error('获取审计日志失败');
    }
  })();

  console.log('========================================');
  console.log('  测试结果汇总');
  console.log('========================================');
  console.log(`  通过: ${passCount}`);
  console.log(`  失败: ${failCount}`);
  console.log(`  总计: ${testResults.length}`);
  console.log('========================================\n');

  if (failCount > 0) {
    console.log('失败的测试:');
    testResults.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
    console.log('');
    process.exit(1);
  } else {
    console.log('所有测试通过！');
    process.exit(0);
  }
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('测试执行失败:', err.message);
    process.exit(1);
  });
}

module.exports = { makeRequest };
