const http = require('http');

function httpRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('=== 开始测试 ===\n');

  console.log('1. 测试健康检查');
  const health = await httpRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/health',
    method: 'GET'
  });
  console.log('   状态:', health.status);
  console.log('   结果:', health.body, '\n');

  console.log('2. 导入泊位数据 (JSON)');
  const berthForm = require('fs').readFileSync('data/sample_berths.json');
  const boundary = '----WebKitFormBoundary' + Date.now();
  const berthBody = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="berths.json"\r\nContent-Type: application/json\r\n\r\n${berthForm}\r\n--${boundary}--\r\n`;
  
  const berthImport = await httpRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/import/berths',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(berthBody)
    }
  }, berthBody);
  console.log('   状态:', berthImport.status);
  console.log('   结果:', berthImport.body, '\n');

  console.log('3. 创建批次');
  const batchRes = await httpRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/batches',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({
    name: '测试批次-船期导入',
    created_by: 'tester'
  }));
  console.log('   状态:', batchRes.status);
  console.log('   结果:', batchRes.body);
  const batchId = batchRes.body.id;
  console.log('   批次ID:', batchId, '\n');

  console.log('4. 导入船期CSV并生成调度记录');
  const vesselCsv = require('fs').readFileSync('data/sample_vessels.csv');
  const vesselBody = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="vessels.csv"\r\nContent-Type: text/csv\r\n\r\n${vesselCsv}\r\n--${boundary}\r\nContent-Disposition: form-data; name="create_records"\r\n\r\ntrue\r\n--${boundary}\r\nContent-Disposition: form-data; name="batch_id"\r\n\r\n${batchId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="created_by"\r\n\r\ntester\r\n--${boundary}--\r\n`;
  
  const vesselImport = await httpRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/import/vessels',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(vesselBody)
    }
  }, vesselBody);
  console.log('   状态:', vesselImport.status);
  console.log('   结果:', vesselImport.body);
  console.log('   生成记录数:', vesselImport.body.count, '\n');

  console.log('5. 查询该批次下的调度记录列表');
  const records = await httpRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/records?batch_id=${batchId}`,
    method: 'GET'
  });
  console.log('   状态:', records.status);
  console.log('   查询到记录数:', records.body.length);
  const listCount = records.body.length;
  console.log('   记录:', records.body.map(r => ({ no: r.record_no, vessel: r.vessel_name, status: r.status })), '\n');

  console.log('6. 测试布尔值筛选一致性 - agent_confirmed=false');
  const confirmedFalseList = await httpRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/records?batch_id=${batchId}&agent_confirmed=false`,
    method: 'GET'
  });
  console.log('   列表查询结果数:', confirmedFalseList.body.length);
  
  const confirmedFalseExport = await httpRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/export/summary?batch_id=${batchId}&agent_confirmed=false`,
    method: 'GET'
  });
  console.log('   导出统计结果数:', confirmedFalseExport.body.count);
  
  const match1 = confirmedFalseList.body.length === confirmedFalseExport.body.count;
  console.log('   结果一致:', match1 ? '✓ PASS' : '✗ FAIL', '\n');

  console.log('7. 测试布尔值筛选一致性 - agent_confirmed=true (应为0)');
  const confirmedTrueList = await httpRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/records?batch_id=${batchId}&agent_confirmed=true`,
    method: 'GET'
  });
  console.log('   列表查询结果数:', confirmedTrueList.body.length);
  
  const confirmedTrueExport = await httpRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/export/summary?batch_id=${batchId}&agent_confirmed=true`,
    method: 'GET'
  });
  console.log('   导出统计结果数:', confirmedTrueExport.body.count);
  
  const match2 = confirmedTrueList.body.length === confirmedTrueExport.body.count;
  console.log('   结果一致:', match2 ? '✓ PASS' : '✗ FAIL', '\n');

  console.log('8. 确认第一条记录，然后再次测试筛选');
  if (records.body.length > 0) {
    const firstRecordId = records.body[0].id;
    await httpRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/records/${firstRecordId}/confirm-agent`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ confirmed_by: 'tester' }));
    
    const confirmedList = await httpRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/records?batch_id=${batchId}&agent_confirmed=true`,
      method: 'GET'
    });
    console.log('   确认后列表查询结果数:', confirmedList.body.length);
    
    const confirmedExport = await httpRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/export/summary?batch_id=${batchId}&agent_confirmed=true`,
      method: 'GET'
    });
    console.log('   确认后导出统计结果数:', confirmedExport.body.count);
    
    const match3 = confirmedList.body.length === confirmedExport.body.count;
    console.log('   结果一致:', match3 ? '✓ PASS' : '✗ FAIL', '\n');
  }

  console.log('9. 查看单条记录详情（含操作日志）');
  if (records.body.length > 0) {
    const firstRecordId = records.body[0].id;
    const detail = await httpRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/records/${firstRecordId}`,
      method: 'GET'
    });
    console.log('   记录号:', detail.body.record.record_no);
    console.log('   操作日志数:', detail.body.operation_logs.length);
    console.log('   操作日志:', detail.body.operation_logs.map(l => ({ type: l.operation_type, status: l.operation_status, handler: l.handled_by })), '\n');
  }

  console.log('10. 导出CSV验证');
  const exportCsv = await httpRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/export/records?batch_id=${batchId}`,
    method: 'GET'
  });
  const csvLines = exportCsv.body.split('\n').filter(l => l.trim().length > 0);
  console.log('   CSV导出行数(含表头):', csvLines.length);
  console.log('   数据行数:', csvLines.length - 1);
  console.log('   与列表数量一致:', (csvLines.length - 1) === listCount ? '✓ PASS' : '✗ FAIL', '\n');

  console.log('=== 测试总结 ===');
  console.log('导出与查询结果一致性:', match1 && match2 ? '✓ 全部通过' : '✗ 存在不一致');
  console.log('导入生成调度记录功能:', vesselImport.body.create_records ? '✓ 已启用并成功' : '✗ 未启用或失败');
  console.log('记录可追踪性:', records.body.length > 0 && detail.body.operation_logs.length > 0 ? '✓ 可追踪' : '✗ 不可追踪');
  console.log('\n=== 测试完成 ===');
}

runTests().catch(console.error);
