const http = require('http');

function apiRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
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

async function run() {
  console.log('=== 便利店运营后端服务测试 ===\n');
  
  const health = await apiRequest('GET', '/api/health');
  test('健康检查', health.status === 200 && health.data.status === 'ok');
  
  const loc = await apiRequest('POST', '/api/query/locations', { location_code: 'T001', location_name: '测试店', manager: '测试员' });
  test('创建点位', loc.status === 200);
  
  const sku = await apiRequest('POST', '/api/query/sku-mappings', { sku_code: 'T001', sku_name: '测试商品', alias: '测试', category: '测试' });
  test('创建SKU映射', sku.status === 200);
  
  const batch = await apiRequest('POST', '/api/batches', { location_code: 'T001', batch_type: 'inventory', responsible_person: '测试员' });
  test('创建批次', batch.status === 200 && batch.data.id > 0);
  const batchId = batch.data.id;
  
  const batches = await apiRequest('GET', '/api/batches?location_code=T001');
  test('查询批次列表', batches.status === 200 && batches.data.length > 0);
  
  const batchDetail = await apiRequest('GET', '/api/batches/' + batchId);
  test('查询批次详情', batchDetail.status === 200 && batchDetail.data.batch);
  
  const process = await apiRequest('POST', '/api/batches/' + batchId + '/process', { action: 'approve', reason: '测试通过', handler: '测试审核' });
  test('处理批次-批准', process.status === 200 && process.data.status === 'approved');
  
  const sales = await apiRequest('POST', '/api/import/sales/' + batchId, [{ sku_code: 'T001', sku_name: '测试商品', quantity: 5, amount: 25, sale_time: '2026-05-20 12:00:00' }]);
  test('导入销售数据', sales.status === 200 && sales.data.imported === 1);
  
  const querySales = await apiRequest('GET', '/api/query/sales?location_code=T001');
  test('查询销售记录', querySales.status === 200);
  
  const report = await apiRequest('GET', '/api/export/batch/' + batchId + '/report');
  test('导出批次报告', report.status === 200 && report.data.batch_info);
  
  console.log('\n=== 测试结果 ===');
  console.log(`通过: ${passed}, 失败: ${failed}`);
  console.log(`成功率: ${Math.round(passed/(passed+failed)*100)}%`);
  
  if (failed === 0) {
    console.log('\n所有测试通过！');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

setTimeout(run, 1000);
