const http = require('http');
const fs = require('fs');

function postForm(url, formData) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
    let body = '';
    
    for (const [key, value] of Object.entries(formData)) {
      if (value.buffer) {
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="${key}"; filename="${value.filename}"\r\n`;
        body += `Content-Type: ${value.contentType || 'application/octet-stream'}\r\n\r\n`;
        body = Buffer.concat([Buffer.from(body), value.buffer, Buffer.from('\r\n')]);
      } else {
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
      }
    }
    body += `--${boundary}--\r\n`;
    
    const urlObj = new URL(url);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body),
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    }, (res) => {
      let respData = '';
      res.on('data', chunk => respData += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(respData)); }
        catch (e) { resolve(respData); }
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

async function test() {
  console.log('=== 测试对账复核修复 ===\n');
  
  console.log('1. 批量导入示例数据');
  const maintenanceBuffer = fs.readFileSync('./samples/maintenance.csv');
  const sensorBuffer = fs.readFileSync('./samples/sensor.json');
  const approvalBuffer = fs.readFileSync('./samples/approval.csv');
  
  const batchResult = await postForm('http://localhost:3000/api/import/batch', {
    maintenance: { buffer: maintenanceBuffer, filename: 'maintenance.csv', contentType: 'text/csv' },
    sensor: { buffer: sensorBuffer, filename: 'sensor.json', contentType: 'application/json' },
    approval: { buffer: approvalBuffer, filename: 'approval.csv', contentType: 'text/csv' },
  });
  console.log('Batch ID:', batchResult.data.batchId);
  console.log('导入结果:', JSON.stringify(batchResult.data, null, 2));
  console.log('');
  
  const batchId = batchResult.data.batchId;
  
  console.log('2. 执行对账');
  const recResult = await postJson(`http://localhost:3000/api/reconciliation/${batchId}`, {});
  console.log('对账结果 - 汇总:');
  console.log('  总缆车数:', recResult.data.totalCableCars);
  console.log('  通过数:', recResult.data.passedCount);
  console.log('  失败数:', recResult.data.failedCount);
  console.log('  总差异:', recResult.data.summary.totalDiffs);
  console.log('  高危差异:', recResult.data.summary.bySeverity.high);
  console.log('  通过率:', recResult.data.summary.passRate.toFixed(2) + '%');
  console.log('');
  
  const resultId = recResult.data.id;
  const highDiffIds = recResult.data.diffs.filter(d => d.severity === 'high').map(d => d.id);
  console.log('3. 高危差异数量:', highDiffIds.length);
  console.log('');
  
  console.log('4. 将所有高危差异标记为 resolved');
  for (let i = 0; i < highDiffIds.length; i++) {
    const diffId = highDiffIds[i];
    console.log(`  复核差异 ${i + 1}/${highDiffIds.length}: ${diffId}`);
    await postJson(`http://localhost:3000/api/review/${resultId}/diff/${diffId}`, {
      reviewer: '测试员',
      action: 'resolve',
      notes: '已修复问题'
    });
  }
  console.log('');
  
  console.log('5. 重新计算汇总');
  const recalcResult = await postJson(`http://localhost:3000/api/reconciliation/${resultId}/recalculate`, {});
  console.log('重新计算后 - 汇总:');
  console.log('  总缆车数:', recalcResult.data.totalCableCars);
  console.log('  通过数:', recalcResult.data.passedCount);
  console.log('  失败数:', recalcResult.data.failedCount);
  console.log('  总差异:', recalcResult.data.summary.totalDiffs);
  console.log('  高危差异:', recalcResult.data.summary.bySeverity.high);
  console.log('  通过率:', recalcResult.data.summary.passRate.toFixed(2) + '%');
  console.log('');
  
  console.log('6. 生成报告验证');
  const reportResult = await postJson('http://localhost:3000/api/report', {
    batchId,
    resultId,
    generatedBy: '测试员'
  });
  console.log('报告中的汇总:');
  console.log('  总差异:', reportResult.data.summary.totalDiffs);
  console.log('  高危差异:', reportResult.data.summary.bySeverity.high);
  console.log('  通过率:', reportResult.data.summary.passRate.toFixed(2) + '%');
  console.log('');
  
  console.log('=== 验证结果 ===');
  const beforeHigh = recResult.data.summary.bySeverity.high;
  const afterHigh = recalcResult.data.summary.bySeverity.high;
  const beforeRate = recResult.data.summary.passRate;
  const afterRate = recalcResult.data.summary.passRate;
  
  console.log(`高危差异: ${beforeHigh} -> ${afterHigh}`);
  console.log(`通过率: ${beforeRate.toFixed(2)}% -> ${afterRate.toFixed(2)}%`);
  
  if (afterHigh === 0 && afterRate === 100) {
    console.log('✅ 修复验证通过！复核后高危差异归零，通过率100%');
  } else {
    console.log('❌ 修复验证失败');
    process.exit(1);
  }
}

test().catch(console.error);
