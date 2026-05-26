const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/api';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
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

async function healthCheck() {
  console.log('1. 健康检查...');
  const res = await request({
    method: 'GET',
    hostname: 'localhost',
    port: 3000,
    path: '/api/health'
  });
  console.log('   状态:', res.status, res.data);
  return res.status === 200;
}

async function importPackages() {
  console.log('\n2. 导入套餐 CSV...');
  
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16);
  const fileContent = fs.readFileSync(path.join(__dirname, '../samples/packages.csv'), 'utf8');
  
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="packages.csv"',
    'Content-Type: text/csv',
    '',
    fileContent,
    `--${boundary}`,
    'Content-Disposition: form-data; name="store_code"',
    '',
    'HQ001',
    `--${boundary}--`
  ].join('\r\n');

  const res = await request({
    method: 'POST',
    hostname: 'localhost',
    port: 3000,
    path: '/api/batches/import/packages',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'x-operator': 'Manager_Wang'
    }
  }, body);
  
  console.log('   状态:', res.status);
  console.log('   结果:', JSON.stringify(res.data, null, 2));
  return res.data;
}

async function importWorkOrders() {
  console.log('\n3. 导入工单 JSON...');
  
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16);
  const fileContent = fs.readFileSync(path.join(__dirname, '../samples/workorders.json'), 'utf8');
  
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="workorders.json"',
    'Content-Type: application/json',
    '',
    fileContent,
    `--${boundary}`,
    'Content-Disposition: form-data; name="store_code"',
    '',
    'HQ001',
    `--${boundary}--`
  ].join('\r\n');

  const res = await request({
    method: 'POST',
    hostname: 'localhost',
    port: 3000,
    path: '/api/batches/import/workorders',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'x-operator': 'Manager_Wang'
    }
  }, body);
  
  console.log('   状态:', res.status);
  console.log('   结果:', JSON.stringify(res.data, null, 2));
  return res.data;
}

async function importStock() {
  console.log('\n4. 导入库存 CSV...');
  
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16);
  const fileContent = fs.readFileSync(path.join(__dirname, '../samples/stock.csv'), 'utf8');
  
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="stock.csv"',
    'Content-Type: text/csv',
    '',
    fileContent,
    `--${boundary}`,
    'Content-Disposition: form-data; name="store_code"',
    '',
    'HQ001',
    `--${boundary}--`
  ].join('\r\n');

  const res = await request({
    method: 'POST',
    hostname: 'localhost',
    port: 3000,
    path: '/api/batches/import/stock',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'x-operator': 'Stock_Keeper_Li'
    }
  }, body);
  
  console.log('   状态:', res.status);
  console.log('   结果:', JSON.stringify(res.data, null, 2));
  return res.data;
}

async function getBatches() {
  console.log('\n5. 获取批次列表...');
  const res = await request({
    method: 'GET',
    hostname: 'localhost',
    port: 3000,
    path: '/api/batches?page=1&pageSize=10'
  });
  
  console.log('   状态:', res.status);
  console.log('   批次数量:', res.data.data.total);
  return res.data.data.list;
}

async function processBatchItems(batchId, itemType) {
  console.log(`\n6. 处理${itemType}批次项...`);
  
  const res = await request({
    method: 'GET',
    hostname: 'localhost',
    port: 3000,
    path: `/api/batches/${batchId}/items`
  });
  
  const items = res.data.data;
  console.log(`   共 ${items.length} 条记录`);
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (itemType === 'workorder' && item.item_data.needs_review) {
      console.log(`   记录${i + 1}: 需要人工修正 - ${item.item_data.review_reason}`);
      
      await request({
        method: 'POST',
        hostname: 'localhost',
        port: 3000,
        path: `/api/batches/items/${item.id}/process`,
        headers: { 'Content-Type': 'application/json', 'x-operator': 'Manager_Wang' }
      }, {
        action: 'return',
        reason: '客户信息不完整，请补充客户姓名和车牌号',
        itemType: itemType
      });
      
      console.log('      已退回修改');
      continue;
    }
    
    if (itemType === 'workorder' && item.item_data.is_cross_store) {
      console.log(`   记录${i + 1}: 跨店核销工单 ${item.item_data.order_no}`);
      
      await request({
        method: 'POST',
        hostname: 'localhost',
        port: 3000,
        path: `/api/batches/items/${item.id}/process`,
        headers: { 'Content-Type': 'application/json', 'x-operator': 'Manager_Wang' }
      }, {
        action: 'approve',
        reason: '跨店核销：客户在ST001购买的套餐，在ST002使用，已核实',
        itemType: itemType
      });
      
      console.log('      已审核通过（跨店核销）');
      continue;
    }
    
    if (itemType === 'workorder' && item.item_data.item_replacement) {
      console.log(`   记录${i + 1}: 项目替换工单 ${item.item_data.order_no}`);
      
      await request({
        method: 'POST',
        hostname: 'localhost',
        port: 3000,
        path: `/api/batches/items/${item.id}/process`,
        headers: { 'Content-Type': 'application/json', 'x-operator': 'Manager_Wang' }
      }, {
        action: 'approve',
        reason: '项目替换：客户要求增加发动机清洗，已告知费用并获同意',
        itemType: itemType
      });
      
      console.log('      已审核通过（项目替换）');
      continue;
    }
    
    await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3000,
      path: `/api/batches/items/${item.id}/process`,
      headers: { 'Content-Type': 'application/json', 'x-operator': 'Manager_Wang' }
    }, {
      action: 'approve',
      reason: '信息完整，审核通过',
      itemType: itemType
    });
    
    console.log(`   记录${i + 1}: 审核通过 ${item.item_code || ''}`);
  }
}

async function queryData() {
  console.log('\n7. 查询数据...');
  
  console.log('   - 查询套餐列表:');
  const pkgRes = await request({
    method: 'GET',
    hostname: 'localhost',
    port: 3000,
    path: '/api/packages?pageSize=5'
  });
  console.log('     套餐数量:', pkgRes.data.data.total);
  
  console.log('   - 查询工单列表:');
  const orderRes = await request({
    method: 'GET',
    hostname: 'localhost',
    port: 3000,
    path: '/api/workorders?pageSize=5'
  });
  console.log('     工单数量:', orderRes.data.data.total);
  
  console.log('   - 查询库存列表:');
  const stockRes = await request({
    method: 'GET',
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts?pageSize=5'
  });
  console.log('     配件数量:', stockRes.data.data.total);
  
  console.log('   - 查询操作日志:');
  const logRes = await request({
    method: 'GET',
    hostname: 'localhost',
    port: 3000,
    path: '/api/logs?pageSize=10'
  });
  console.log('     日志数量:', logRes.data.data.total);
  
  if (logRes.data.data.list.length > 0) {
    console.log('\n   最近操作记录:');
    logRes.data.data.list.slice(0, 5).forEach((log, i) => {
      console.log(`     ${i + 1}. [${log.created_at}] ${log.operator} - ${log.operation_type} - ${log.operation_reason || ''}`);
    });
  }
}

async function getDetailWithTrace() {
  console.log('\n8. 查询工单详情（含审计追踪）...');
  
  const orderRes = await request({
    method: 'GET',
    hostname: 'localhost',
    port: 3000,
    path: '/api/workorders/WO20260520002'
  });
  
  if (orderRes.data.data) {
    const order = orderRes.data.data;
    console.log('   工单:', order.order_no, '-', order.customer_name);
    console.log('   状态:', order.order_status);
    console.log('   操作日志:');
    order.operation_logs.forEach(log => {
      console.log(`     - [${log.created_at}] ${log.operator}: ${log.operation_type} - ${log.operation_reason || ''}`);
    });
  }
}

async function exportData() {
  console.log('\n9. 导出数据...');
  
  const res = await request({
    method: 'POST',
    hostname: 'localhost',
    port: 3000,
    path: '/api/export/workorders'
  });
  
  console.log('   导出状态:', res.status);
  console.log('   导出文件会保存在 exports 目录');
}

async function main() {
  console.log('========================================');
  console.log('  汽修连锁门店后端服务 - API 测试脚本');
  console.log('========================================\n');
  
  try {
    if (!await healthCheck()) {
      console.log('服务未启动，请先运行 npm start');
      process.exit(1);
    }
    
    const pkgResult = await importPackages();
    const orderResult = await importWorkOrders();
    const stockResult = await importStock();
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const batches = await getBatches();
    
    if (pkgResult && pkgResult.data) {
      await processBatchItems(pkgResult.data.batchId, 'package');
    }
    
    if (orderResult && orderResult.data) {
      await processBatchItems(orderResult.data.batchId, 'workorder');
    }
    
    if (stockResult && stockResult.data) {
      await processBatchItems(stockResult.data.batchId, 'stock');
    }
    
    await queryData();
    await getDetailWithTrace();
    await exportData();
    
    console.log('\n========================================');
    console.log('  测试完成！');
    console.log('========================================');
    
  } catch (err) {
    console.error('测试出错:', err.message);
    process.exit(1);
  }
}

main();
