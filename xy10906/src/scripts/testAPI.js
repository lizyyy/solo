const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';
let serverProcess = null;

function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '../server.js');
    serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('服务运行正常') || output.includes('维修工单备件预占 API 服务')) {
        setTimeout(resolve, 500);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('服务错误:', data.toString());
    });

    setTimeout(() => {
      resolve();
    }, 3000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n========================================');
  console.log('  开始运行 API 测试套件');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    process.stdout.write(`  测试: ${name}... `);
    try {
      await fn();
      console.log('✅ 通过');
      passed++;
    } catch (err) {
      console.log('❌ 失败');
      console.log(`     错误: ${err.message}`);
      failed++;
    }
  }

  await test('健康检查接口', async () => {
    const res = await request('/health');
    if (res.status !== 200 || !res.data.success) {
      throw new Error('健康检查失败');
    }
  });

  await test('查询工程师列表', async () => {
    const res = await request('/engineers');
    if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.data)) {
      throw new Error('查询工程师列表失败');
    }
    if (res.data.data.length === 0) {
      throw new Error('工程师列表为空');
    }
  });

  await test('查询备件库存', async () => {
    const res = await request('/spare-parts');
    if (res.status !== 200 || !res.data.success) {
      throw new Error('查询备件库存失败');
    }
  });

  await test('创建新工单', async () => {
    const res = await request('/workorders', {
      method: 'POST',
      body: {
        workorderNo: `WO${Date.now()}`,
        customerName: '测试用户',
        customerPhone: '13800000000',
        address: '测试地址',
        productModel: '测试型号',
        faultDescription: '测试故障'
      }
    });
    if (res.status !== 200 || !res.data.success) {
      throw new Error('创建工单失败: ' + (res.data.message || ''));
    }
  });

  await test('查询工单列表', async () => {
    const res = await request('/workorders');
    if (res.status !== 200 || !res.data.success) {
      throw new Error('查询工单列表失败');
    }
  });

  await test('备件预占 - 正常路径', async () => {
    const res = await request('/reservations', {
      method: 'POST',
      body: {
        workorderId: 2,
        engineerId: 1,
        parts: [
          { partId: 3, quantity: 1 }
        ]
      }
    });
    if (res.status !== 200 || !res.data.success) {
      throw new Error('备件预占失败: ' + (res.data.message || ''));
    }
  });

  await test('备件预占 - 重复扣减拦截', async () => {
    const res = await request('/reservations', {
      method: 'POST',
      body: {
        workorderId: 1,
        engineerId: 1,
        parts: [
          { partId: 1, quantity: 1 }
        ]
      }
    });
    if (res.status === 200) {
      throw new Error('重复预占未被拦截');
    }
  });

  await test('备件预占 - 库存不足拦截', async () => {
    const res = await request('/reservations', {
      method: 'POST',
      body: {
        workorderId: 2,
        engineerId: 1,
        parts: [
          { partId: 1, quantity: 999 }
        ]
      }
    });
    if (res.status === 200) {
      throw new Error('库存不足未被拦截');
    }
  });

  await test('查询预占记录', async () => {
    const res = await request('/reservations');
    if (res.status !== 200 || !res.data.success) {
      throw new Error('查询预占记录失败');
    }
  });

  await test('查询异常日志', async () => {
    const res = await request('/exception-logs');
    if (res.status !== 200 || !res.data.success) {
      throw new Error('查询异常日志失败');
    }
  });

  await test('导出预占记录CSV', async () => {
    const res = await request('/export/reservations');
    if (res.status !== 200) {
      throw new Error('导出CSV失败');
    }
  });

  console.log('\n========================================');
  console.log(`  测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

async function main() {
  console.log('\n========================================');
  console.log('  启动 API 服务...');
  console.log('========================================\n');

  try {
    await startServer();
    await runTests();
  } catch (err) {
    console.error('\n测试执行失败:', err.message);
    process.exit(1);
  } finally {
    stopServer();
    process.exit(0);
  }
}

main();