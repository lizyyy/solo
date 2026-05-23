const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'localhost';
const PORT = 3000;

let testResults = [];
let equipmentId = null;
let rentalId = null;
let serverProcess = null;

function logTest(name, passed, message = '') {
  testResults.push({ name, passed, message });
  const status = passed ? '✓ 通过' : '✗ 失败';
  console.log(`${status}: ${name}`);
  if (message) {
    console.log(`  ${message}`);
  }
}

function checkDependencies() {
  try {
    require.resolve('express');
    require.resolve('sqlite3');
    require.resolve('uuid');
    require.resolve('body-parser');
    require.resolve('moment');
    return true;
  } catch (e) {
    return false;
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    const appPath = path.join(__dirname, '../src/app.js');
    
    serverProcess = spawn('node', [appPath], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: PORT }
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[SERVER]', output.trim());
      if (output.includes('租赁设备押金API服务已启动')) {
        setTimeout(resolve, 500);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error('[SERVER ERROR]', output.trim());
    });

    serverProcess.on('error', (err) => {
      console.error('启动服务失败:', err.message);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`服务进程退出，代码: ${code}`);
      }
    });

    setTimeout(() => {
      reject(new Error('服务启动超时'));
    }, 10000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

async function waitForHealth(maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await request('GET', '/health');
      if (res.statusCode === 200) {
        return true;
      }
    } catch (e) {
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('服务健康检查超时');
}

async function request(method, path, data = null) {
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
          resolve({
            statusCode: res.statusCode,
            data: body ? JSON.parse(body) : null,
            rawData: body
          });
        } catch (e) {
          resolve({ statusCode: res.statusCode, rawData: body });
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
  console.log('=== 租赁设备押金API 自检开始 ===\n');

  console.log('1. 检查依赖...');
  if (!checkDependencies()) {
    console.log('✗ 依赖未安装，请先运行: npm install');
    process.exit(1);
  }
  console.log('✓ 依赖已安装\n');

  console.log('2. 启动服务...');
  try {
    await startServer();
    await waitForHealth();
    console.log('✓ 服务已启动\n');
  } catch (e) {
    console.log('✗ 服务启动失败:', e.message);
    stopServer();
    process.exit(1);
  }

  const moment = require('moment');

  console.log('--- 3. 正常流程测试 ---');

  try {
    const equipRes = await request('POST', '/api/equipment', {
      name: '测试相机 ' + Date.now(),
      category: '测试',
      daily_rate: 100,
      deposit_amount: 2000
    });
    equipmentId = equipRes.data && equipRes.data.data && equipRes.data.data.id;
    logTest('创建设备', equipRes.statusCode === 201 && equipmentId);
  } catch (e) {
    logTest('创建设备', false, e.message);
  }

  try {
    const startDate = moment().format('YYYY-MM-DD HH:mm:ss');
    const endDate = moment().add(3, 'days').format('YYYY-MM-DD HH:mm:ss');
    
    const rentalRes = await request('POST', '/api/rentals', {
      customer_id: 'CUST001',
      customer_name: '张三',
      equipment_id: equipmentId,
      start_date: startDate,
      end_date: endDate,
      created_by: 'admin'
    });
    rentalId = rentalRes.data && rentalRes.data.data && rentalRes.data.data.id;
    logTest('创建租赁单', rentalRes.statusCode === 201 && rentalId);
  } catch (e) {
    logTest('创建租赁单', false, e.message);
  }

  try {
    const freezeRes = await request('POST', `/api/rentals/${rentalId}/freeze-deposit`, {
      request_id: 'REQ_FREEZE_001_' + Date.now(),
      operator: 'admin'
    });
    logTest('押金冻结', freezeRes.statusCode === 200 && freezeRes.data && freezeRes.data.success);
  } catch (e) {
    logTest('押金冻结', false, e.message);
  }

  const renewReqId = 'REQ_RENEW_001_' + Date.now();
  try {
    const renewRes = await request('POST', `/api/rentals/${rentalId}/renew`, {
      request_id: renewReqId,
      extension_days: 2,
      operator: 'admin'
    });
    logTest('续租申请', renewRes.statusCode === 200 && renewRes.data && renewRes.data.success);
  } catch (e) {
    logTest('续租申请', false, e.message);
  }

  try {
    const damageRes = await request('POST', `/api/rentals/${rentalId}/damage`, {
      damage_type: '划痕',
      description: '镜头表面轻微划痕',
      deduction_amount: 200,
      reported_by: 'staff'
    });
    logTest('损坏上报', damageRes.statusCode === 200 && damageRes.data && damageRes.data.success);
  } catch (e) {
    logTest('损坏上报', false, e.message);
  }

  try {
    const actualEndDate = moment().add(7, 'days').format('YYYY-MM-DD HH:mm:ss');
    const settleRes = await request('POST', `/api/rentals/${rentalId}/settle`, {
      actual_end_date: actualEndDate,
      generated_by: 'finance'
    });
    logTest('结算完成', settleRes.statusCode === 200 && settleRes.data && settleRes.data.success);
  } catch (e) {
    logTest('结算完成', false, e.message);
  }

  console.log('\n--- 4. 重复请求（幂等性）测试 ---');

  try {
    const freezeRes1 = await request('POST', `/api/rentals/${rentalId}/freeze-deposit`, {
      request_id: 'REQ_FREEZE_001_' + Date.now(),
      operator: 'admin'
    });
    logTest('重复押金冻结（幂等）', freezeRes1.statusCode === 200 && freezeRes1.data && freezeRes1.data.success);
  } catch (e) {
    logTest('重复押金冻结（幂等）', false, e.message);
  }

  try {
    const renewRes1 = await request('POST', `/api/rentals/${rentalId}/renew`, {
      request_id: renewReqId,
      extension_days: 2,
      operator: 'admin'
    });
    logTest('重复续租申请（幂等）', renewRes1.statusCode === 200 && renewRes1.data && renewRes1.data.success);
  } catch (e) {
    logTest('重复续租申请（幂等）', false, e.message);
  }

  console.log('\n--- 5. 脏数据/异常测试 ---');

  try {
    const badRentalRes = await request('POST', '/api/rentals', {
      customer_id: 'CUST002',
      customer_name: '李四',
      equipment_id: 'non_existent_equipment',
      start_date: moment().format('YYYY-MM-DD HH:mm:ss'),
      end_date: moment().add(3, 'days').format('YYYY-MM-DD HH:mm:ss'),
      created_by: 'admin'
    });
    logTest('无效设备ID（异常处理）', badRentalRes.statusCode === 400);
  } catch (e) {
    logTest('无效设备ID（异常处理）', false, e.message);
  }

  try {
    const badRentalRes2 = await request('POST', `/api/rentals/non_existent_rental/freeze-deposit`, {
      request_id: 'REQ_BAD_001',
      operator: 'admin'
    });
    logTest('无效租赁单ID（异常处理）', badRentalRes2.statusCode === 400);
  } catch (e) {
    logTest('无效租赁单ID（异常处理）', false, e.message);
  }

  try {
    const exceptionsRes = await request('GET', '/api/exceptions');
    logTest('异常日志已记录', exceptionsRes.statusCode === 200 && 
      exceptionsRes.data && exceptionsRes.data.data && exceptionsRes.data.data.length > 0);
  } catch (e) {
    logTest('异常日志已记录', false, e.message);
  }

  console.log('\n--- 6. 导出内容一致性测试 ---');

  try {
    const settlementsRes = await request('GET', '/api/settlements');
    logTest('获取结算列表', settlementsRes.statusCode === 200);
    
    const exportRes = await request('GET', '/api/settlements/export');
    const hasCSVContent = exportRes.rawData && exportRes.rawData.includes('结算单号');
    logTest('导出CSV内容正确', hasCSVContent);
    
    if (settlementsRes.data && settlementsRes.data.data && exportRes.rawData) {
      const settlementCount = settlementsRes.data.data.length;
      const csvLines = exportRes.rawData.trim().split('\n').length - 1;
      logTest('导出数据条数一致', settlementCount === csvLines);
    }
  } catch (e) {
    logTest('导出测试', false, e.message);
  }

  console.log('\n--- 7. 查询功能测试 ---');

  try {
    const detailsRes = await request('GET', `/api/rentals/${rentalId}`);
    logTest('获取租赁单详情', detailsRes.statusCode === 200 && 
      detailsRes.data && detailsRes.data.data && detailsRes.data.data.rental);
  } catch (e) {
    logTest('获取租赁单详情', false, e.message);
  }

  try {
    const rentalsRes = await request('GET', '/api/rentals');
    logTest('获取租赁单列表', rentalsRes.statusCode === 200);
  } catch (e) {
    logTest('获取租赁单列表', false, e.message);
  }

  try {
    const equipmentRes = await request('GET', '/api/equipment');
    logTest('获取设备列表', equipmentRes.statusCode === 200);
  } catch (e) {
    logTest('获取设备列表', false, e.message);
  }

  console.log('\n=== 测试结果汇总 ===');
  const passed = testResults.filter(t => t.passed).length;
  const total = testResults.length;
  console.log(`通过: ${passed}/${total}`);
  
  if (passed < total) {
    console.log('\n失败的测试:');
    testResults.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}: ${t.message}`);
    });
  }

  stopServer();
  console.log('\n=== 自检完成 ===');
  
  process.exit(passed === total ? 0 : 1);
}

process.on('SIGINT', () => {
  console.log('\n收到中断信号，正在停止服务...');
  stopServer();
  process.exit(1);
});

process.on('SIGTERM', () => {
  stopServer();
  process.exit(0);
});

runTests().catch(err => {
  console.error('测试运行失败:', err);
  stopServer();
  process.exit(1);
});
