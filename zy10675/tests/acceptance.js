const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/api/qualifications';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function logTest(name, passed, message = '') {
  const status = passed ? '✓ 通过' : '✗ 失败';
  console.log(`${status} - ${name}`);
  if (message) console.log(`  ${message}`);
}

async function runTests() {
  console.log('========================================');
  console.log('  社群运营后台群活动资格补录 API 验收测试');
  console.log('========================================\n');

  let qualificationId = null;

  console.log('--- 测试1: 完整流转测试 ---');
  
  try {
    const createRes = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3000,
      path: '/api/qualifications',
      headers: { 'Content-Type': 'application/json' }
    }, {
      member_id: 'M001',
      activity_id: 'A001',
      reason: '测试补录资格',
      operator_id: 'OP001',
      operator_name: '管理员'
    });

    if (createRes.status === 201 && createRes.body.id) {
      qualificationId = createRes.body.id;
      logTest('创建资格记录', true, `ID: ${qualificationId}`);
    } else {
      logTest('创建资格记录', false, createRes.body.error);
    }
  } catch (e) {
    logTest('创建资格记录', false, e.message);
  }

  try {
    const listRes = await request({
      method: 'GET',
      hostname: 'localhost',
      port: 3000,
      path: '/api/qualifications'
    });
    logTest('查询资格列表', listRes.status === 200 && Array.isArray(listRes.body));
  } catch (e) {
    logTest('查询资格列表', false, e.message);
  }

  try {
    const detailRes = await request({
      method: 'GET',
      hostname: 'localhost',
      port: 3000,
      path: `/api/qualifications/${qualificationId}`
    });
    logTest('查看资格详情', detailRes.status === 200 && detailRes.body.qualification_id === qualificationId);
  } catch (e) {
    logTest('查看资格详情', false, e.message);
  }

  try {
    const updateRes = await request({
      method: 'PUT',
      hostname: 'localhost',
      port: 3000,
      path: `/api/qualifications/${qualificationId}`,
      headers: { 'Content-Type': 'application/json' }
    }, {
      reason: '修改后的补录原因',
      operator_id: 'OP001',
      operator_name: '管理员'
    });
    logTest('修改资格记录', updateRes.status === 200 && updateRes.body.success);
  } catch (e) {
    logTest('修改资格记录', false, e.message);
  }

  try {
    const reviewRes = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3000,
      path: `/api/qualifications/${qualificationId}/review`,
      headers: { 'Content-Type': 'application/json' }
    }, {
      approved: true,
      remark: '审核通过',
      operator_id: 'OP002',
      operator_name: '审核员'
    });
    logTest('审核通过资格', reviewRes.status === 200 && reviewRes.body.status === '已获得');
  } catch (e) {
    logTest('审核通过资格', false, e.message);
  }

  try {
    const revokeRes = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3000,
      path: `/api/qualifications/${qualificationId}/revoke`,
      headers: { 'Content-Type': 'application/json' }
    }, {
      reason: '资格撤销原因',
      operator_id: 'OP001',
      operator_name: '管理员'
    });
    logTest('撤销资格', revokeRes.status === 200 && revokeRes.body.status === '已撤销');
  } catch (e) {
    logTest('撤销资格', false, e.message);
  }

  console.log('\n--- 测试2: 冲突记录测试 ---');

  let conflictQualId = null;
  try {
    const create1 = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3000,
      path: '/api/qualifications',
      headers: { 'Content-Type': 'application/json' }
    }, {
      member_id: 'M002',
      activity_id: 'A001',
      reason: '冲突测试第一条',
      operator_id: 'OP001',
      operator_name: '管理员'
    });
    conflictQualId = create1.body.id;
    logTest('创建第一条资格记录', create1.status === 201);

    const create2 = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3000,
      path: '/api/qualifications',
      headers: { 'Content-Type': 'application/json' }
    }, {
      member_id: 'M002',
      activity_id: 'A001',
      reason: '冲突测试第二条',
      operator_id: 'OP001',
      operator_name: '管理员'
    });
    logTest('检测重复创建冲突', create2.status === 409);
  } catch (e) {
    logTest('冲突记录测试', false, e.message);
  }

  console.log('\n--- 测试3: 导入坏行测试 ---');

  try {
    const testCsv = `member_id,activity_id,reason
M001,A002,正常导入
M003,A002,已退群成员
,缺少字段
M999,A002,不存在成员
M004,A002,另一个正常导入`;

    const boundary = '----WebKitFormBoundary';
    let body = `------${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="test.csv"\r\n`;
    body += `Content-Type: text/csv\r\n\r\n`;
    body += testCsv + '\r\n';
    body += `------${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="operator_id"\r\n\r\nOP001\r\n`;
    body += `------${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="operator_name"\r\n\r\n管理员\r\n`;
    body += `------${boundary}--\r\n`;

    const importRes = await new Promise((resolve, reject) => {
      const req = http.request({
        method: 'POST',
        hostname: 'localhost',
        port: 3000,
        path: '/api/qualifications/import/batch',
        headers: {
          'Content-Type': `multipart/form-data; boundary=----${boundary}`,
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    logTest('批量导入完成', importRes.status === 200);
    logTest('成功导入正常行', importRes.body.success === 2);
    logTest('正确标记失败行', importRes.body.failed === 3);
    
    const hasLeftGroup = importRes.body.errors.some(e => e.error === '成员已退群');
    logTest('识别已退群成员', hasLeftGroup);
    
    const hasMissingField = importRes.body.errors.some(e => e.error === '缺少必要字段');
    logTest('识别缺少字段', hasMissingField);
    
    const hasNotExist = importRes.body.errors.some(e => e.error === '成员不存在');
    logTest('识别不存在成员', hasNotExist);
  } catch (e) {
    logTest('批量导入测试', false, e.message);
  }

  console.log('\n--- 测试4: 导出功能测试 ---');

  try {
    const exportRes = await request({
      method: 'GET',
      hostname: 'localhost',
      port: 3000,
      path: '/api/qualifications/export/data'
    });
    logTest('导出CSV数据', exportRes.status === 200 && typeof exportRes.body === 'string');
  } catch (e) {
    logTest('导出CSV数据', false, e.message);
  }

  console.log('\n--- 测试5: 历史记录一致性 ---');

  try {
    const detailRes = await request({
      method: 'GET',
      hostname: 'localhost',
      port: 3000,
      path: `/api/qualifications/${qualificationId}`
    });
    
    const logs = detailRes.body.audit_logs;
    const hasCreate = logs.some(l => l.action === '创建');
    const hasUpdate = logs.some(l => l.action === '修改');
    const hasReview = logs.some(l => l.action === '审核通过');
    const hasRevoke = logs.some(l => l.action === '撤销');
    
    logTest('历史记录完整', hasCreate && hasUpdate && hasReview && hasRevoke);
  } catch (e) {
    logTest('历史记录一致性', false, e.message);
  }

  console.log('\n========================================');
  console.log('  测试完成');
  console.log('========================================');
}

runTests().catch(console.error);
