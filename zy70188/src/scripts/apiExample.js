const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-operator-id': 'test_operator',
        'x-operator-name': '测试操作员',
        ...headers
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          console.log(`\n[${method}] ${path}`);
          console.log(`状态码: ${res.statusCode}`);
          console.log('响应:', JSON.stringify(parsed, null, 2));
          resolve(parsed);
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

async function runExample() {
  console.log('=== 统一收据号段 API 测试示例 ===\n');

  try {
    await makeRequest('GET', '/health');

    console.log('\n--- 1. 创建号段池 ---');
    const segment = await makeRequest('POST', '/segment-pools', {
      segment_code: 'DEMO_2024',
      segment_name: '演示号段',
      prefix: 'DEMO',
      start_number: 100001,
      end_number: 200000,
      description: 'API演示用号段'
    });

    if (segment.code === 1000 || segment.code === 400) {
      console.log('号段可能已存在，继续使用现有号段...');
    }

    console.log('\n--- 2. 查询号段列表 ---');
    await makeRequest('GET', '/segment-pools');

    console.log('\n--- 3. 窗口1分配收据号 ---');
    const assignment1 = await makeRequest('POST', '/assignments/assign', {
      window_id: 'window001',
      window_name: '收费窗口1',
      business_id: 'BUS001',
      business_type: 'normal',
      amount: 100.50
    });

    const receipt1 = assignment1.data?.receipt_number;
    console.log(`分配到的收据号: ${receipt1}`);

    console.log('\n--- 4. 窗口2分配收据号 ---');
    const assignment2 = await makeRequest('POST', '/assignments/assign', {
      window_id: 'window002',
      window_name: '收费窗口2',
      business_id: 'BUS002',
      business_type: 'normal',
      amount: 200.00
    });

    const receipt2 = assignment2.data?.receipt_number;
    console.log(`分配到的收据号: ${receipt2}`);

    console.log('\n--- 5. 作废第一张收据 ---');
    if (receipt1) {
      await makeRequest('POST', '/voids', {
        receipt_number: receipt1,
        void_reason: '客户信息填写错误',
        is_recoverable: true
      });
    }

    console.log('\n--- 6. 回收作废的收据 ---');
    if (receipt1) {
      await makeRequest('POST', '/recovers', {
        receipt_numbers: [receipt1]
      });
    }

    console.log('\n--- 7. 再次分配 - 应该优先使用回收的号 ---');
    await makeRequest('POST', '/assignments/assign', {
      window_id: 'window003',
      window_name: '收费窗口3',
      business_id: 'BUS003',
      business_type: 'normal',
      amount: 150.00
    });

    console.log('\n--- 8. 补打收据 ---');
    if (receipt2) {
      await makeRequest('POST', '/reprints', {
        receipt_number: receipt2,
        reprint_reason: '收据损坏',
        window_id: 'window001'
      });
    }

    console.log('\n--- 9. 查询分配记录 ---');
    await makeRequest('GET', '/assignments?page=1&pageSize=10');

    console.log('\n--- 10. 获取号段池统计 ---');
    await makeRequest('GET', '/segment-pools/stats');

    console.log('\n=== 测试完成 ===');

  } catch (error) {
    console.error('测试过程中发生错误:', error.message);
    console.log('请先确保API服务已启动: npm start');
  }
}

runExample();
