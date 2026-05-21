const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', 'data', 'test.db');
const SERVER_PATH = path.join(__dirname, '..', 'src', 'server.js');

let serverProcess = null;

function startServer() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
    
    const env = { ...process.env, DB_PATH: TEST_DB, PORT: '3001' };
    serverProcess = spawn('node', [SERVER_PATH], { env, cwd: path.join(__dirname, '..') });
    
    let serverReady = false;
    let startupOutput = '';
    
    serverProcess.stdout.on('data', (data) => {
      startupOutput += data.toString();
      if (startupOutput.includes('Server running') || startupOutput.includes('3001')) {
        if (!serverReady) {
          serverReady = true;
          setTimeout(resolve, 500);
        }
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      startupOutput += data.toString();
    });
    
    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Server startup timeout. Output: ' + startupOutput));
      }
    }, 5000);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      setTimeout(resolve, 500);
    } else {
      resolve();
    }
  });
}

function apiRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

let passed = 0, failed = 0;
function test(name, ok) {
  if (ok) { console.log(`✓ ${name}`); passed++; }
  else { console.log(`✗ ${name}`); failed++; }
}

async function runTests() {
  console.log('=== 便利店运营后端服务测试 ===\n');
  
  const health = await apiRequest('GET', '/api/health');
  test('健康检查', health.status === 200 && health.data.status === 'ok');
  
  const loc = await apiRequest('POST', '/api/query/locations', { location_code: 'TEST01', location_name: '测试门店', manager: '张经理' });
  test('创建点位', loc.status === 200);
  
  const sku = await apiRequest('POST', '/api/query/sku-mappings', { sku_code: 'SKUT01', sku_name: '可口可乐500ml', alias: '可乐', category: '饮料' });
  test('创建SKU映射', sku.status === 200);
  
  const batch = await apiRequest('POST', '/api/batches', { location_code: 'TEST01', batch_type: 'inventory', responsible_person: '盘点员' });
  test('创建批次', batch.status === 200 && batch.data.id > 0);
  const batchId = batch.data.id;
  
  const batches = await apiRequest('GET', '/api/batches?location_code=TEST01');
  test('查询批次列表', batches.status === 200 && batches.data.length > 0);
  
  const batchDetail = await apiRequest('GET', '/api/batches/' + batchId);
  test('查询批次详情', batchDetail.status === 200 && batchDetail.data.batch);
  
  const process = await apiRequest('POST', '/api/batches/' + batchId + '/process', { action: 'approve', reason: '数据无误', handler: '审核员' });
  test('处理批次-批准', process.status === 200 && process.data.status === 'approved');
  
  const sales = await apiRequest('POST', '/api/import/sales/' + batchId, [{ sku_code: 'SKUT01', sku_name: '可口可乐500ml', quantity: 10, amount: 50, sale_time: '2026-05-20 14:30:00' }]);
  test('导入销售数据', sales.status === 200 && sales.data.imported === 1);
  
  const querySales = await apiRequest('GET', '/api/query/sales?location_code=TEST01');
  test('查询销售记录', querySales.status === 200 && querySales.data.count > 0);
  
  const replenishment = await apiRequest('POST', '/api/import/replenishment/' + batchId, [{ sku_name: '可乐', expected_qty: 20, actual_qty: 25, unit_price: 5, expiry_date: '2026-05-28' }, { sku_code: 'SKUT02', sku_name: '雪碧500ml', expected_qty: 15, actual_qty: 10, unit_price: 5, expiry_date: '2026-06-15' }]);
  test('导入补货数据(含异常和别名)', replenishment.status === 200 && replenishment.data.imported === 2);
  test('SKU别名检测', replenishment.data.alias_detections && replenishment.data.alias_detections.length > 0);
  
  const queryRep = await apiRequest('GET', '/api/query/replenishment?location_code=TEST01');
  test('查询补货记录', queryRep.status === 200 && queryRep.data.count > 0);
  
  const report = await apiRequest('GET', '/api/export/batch/' + batchId + '/report');
  test('导出批次报告', report.status === 200 && report.data.batch_info);
  
  const repRecord = queryRep.data.records && queryRep.data.records[0];
  if (repRecord && repRecord.id) {
    const trace = await apiRequest('GET', '/api/query/record/replenishment/' + repRecord.id);
    test('单条明细追溯', trace.status === 200 && trace.data.record);
  } else {
    test('单条明细追溯', false);
  }
  
  console.log('\n=== 测试结果 ===');
  console.log(`通过: ${passed}, 失败: ${failed}`);
  console.log(`成功率: ${Math.round(passed/(passed+failed)*100)}%`);
  
  if (failed === 0) {
    console.log('\n所有测试通过！');
  }
  
  return failed === 0 ? 0 : 1;
}

async function main() {
  let exitCode = 1;
  try {
    console.log('正在启动测试服务...');
    await startServer();
    console.log('服务启动成功，开始测试...\n');
    exitCode = await runTests();
  } catch (err) {
    console.error('测试失败:', err.message);
    exitCode = 1;
  } finally {
    console.log('\n正在停止服务...');
    await stopServer();
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
    process.exit(exitCode);
  }
}

main();
