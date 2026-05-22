const fs = require('fs');
const path = require('path');
const http = require('http');

const API_BASE = 'http://localhost:3000/api';

console.log('========================================');
console.log('  档案室管理系统 - 接口测试脚本');
console.log('========================================\n');

async function request(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
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
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
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
  const results = [];
  let passed = 0;
  let failed = 0;

  console.log('[1/6] 测试健康检查接口...');
  try {
    const res = await request('/health');
    if (res.status === 200 && res.data.success) {
      console.log('  ✅ 健康检查通过');
      passed++;
      results.push({ name: '健康检查', status: 'PASS' });
    } else {
      console.log('  ❌ 健康检查失败');
      failed++;
      results.push({ name: '健康检查', status: 'FAIL', error: res.data });
    }
  } catch (e) {
    console.log('  ❌ 健康检查失败:', e.message);
    console.log('     提示：请先启动服务 "npm start"');
    failed++;
    results.push({ name: '健康检查', status: 'FAIL', error: e.message });
  }

  console.log('\n[2/6] 测试统计接口...');
  try {
    const res = await request('/query/statistics');
    if (res.status === 200 && res.data.success) {
      console.log('  ✅ 统计接口正常');
      console.log('     总记录数:', res.data.data?.overview?.totalRecords || 0);
      passed++;
      results.push({ name: '统计接口', status: 'PASS' });
    } else {
      console.log('  ❌ 统计接口异常');
      failed++;
      results.push({ name: '统计接口', status: 'FAIL' });
    }
  } catch (e) {
    console.log('  ❌ 统计接口失败:', e.message);
    failed++;
    results.push({ name: '统计接口', status: 'FAIL', error: e.message });
  }

  console.log('\n[3/6] 测试批次列表接口...');
  try {
    const res = await request('/batch/list');
    if (res.status === 200 && res.data.success) {
      console.log('  ✅ 批次列表接口正常');
      console.log('     批次数量:', res.data.data?.batches?.length || 0);
      passed++;
      results.push({ name: '批次列表', status: 'PASS' });
    } else {
      console.log('  ❌ 批次列表接口异常');
      failed++;
      results.push({ name: '批次列表', status: 'FAIL' });
    }
  } catch (e) {
    console.log('  ❌ 批次列表接口失败:', e.message);
    failed++;
    results.push({ name: '批次列表', status: 'FAIL', error: e.message });
  }

  console.log('\n[4/6] 测试历史查询接口...');
  try {
    const res = await request('/query/history', 'POST', {
      page: 1,
      limit: 10
    });
    if (res.status === 200 && res.data.success) {
      console.log('  ✅ 历史查询接口正常');
      console.log('     查询结果数:', res.data.data?.records?.length || 0);
      passed++;
      results.push({ name: '历史查询', status: 'PASS' });
    } else {
      console.log('  ❌ 历史查询接口异常');
      failed++;
      results.push({ name: '历史查询', status: 'FAIL' });
    }
  } catch (e) {
    console.log('  ❌ 历史查询接口失败:', e.message);
    failed++;
    results.push({ name: '历史查询', status: 'FAIL', error: e.message });
  }

  console.log('\n[5/6] 测试导出接口（JSON格式）...');
  try {
    const res = await request('/borrow/export?format=json', 'POST', {});
    if (res.status === 200 && res.data.success) {
      console.log('  ✅ 导出接口正常');
      console.log('     导出数量:', res.data.total || 0);
      passed++;
      results.push({ name: '导出接口', status: 'PASS' });
    } else {
      console.log('  ❌ 导出接口异常');
      failed++;
      results.push({ name: '导出接口', status: 'FAIL' });
    }
  } catch (e) {
    console.log('  ❌ 导出接口失败:', e.message);
    failed++;
    results.push({ name: '导出接口', status: 'FAIL', error: e.message });
  }

  console.log('\n[6/6] 测试操作日志接口...');
  try {
    const res = await request('/query/operation-logs', 'POST', {
      page: 1,
      limit: 10
    });
    if (res.status === 200 && res.data.success) {
      console.log('  ✅ 操作日志接口正常');
      console.log('     日志数量:', res.data.data?.logs?.length || 0);
      passed++;
      results.push({ name: '操作日志', status: 'PASS' });
    } else {
      console.log('  ❌ 操作日志接口异常');
      failed++;
      results.push({ name: '操作日志', status: 'FAIL' });
    }
  } catch (e) {
    console.log('  ❌ 操作日志接口失败:', e.message);
    failed++;
    results.push({ name: '操作日志', status: 'FAIL', error: e.message });
  }

  console.log('\n========================================');
  console.log('  测试结果汇总');
  console.log('========================================');
  console.log(`  通过: ${passed}`);
  console.log(`  失败: ${failed}`);
  console.log(`  总计: ${passed + failed}`);
  console.log('========================================');

  if (failed > 0) {
    console.log('\n  ❌ 部分测试未通过，请检查服务状态');
    console.log('     1. 确保MongoDB已启动');
    console.log('     2. 执行 "npm start" 启动服务');
    console.log('     3. 服务启动后重新运行测试');
    process.exit(1);
  } else {
    console.log('\n  ✅ 所有基础接口测试通过!');
    console.log('     系统可以正常运行');
    process.exit(0);
  }
}

const testsDir = path.dirname(__filename);
if (!fs.existsSync(testsDir)) {
  fs.mkdirSync(testsDir, { recursive: true });
}

runTests().catch(console.error);
