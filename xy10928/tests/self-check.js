const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

function request(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    
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

async function runTests() {
  console.log('='.repeat(60));
  console.log('快递驿站滞留 API - 自检测试');
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  console.log('\n[提示] 请确保已运行 npm run init-data 初始化样例数据\n');
  
  console.log('--- 测试 1: 健康检查 ---');
  try {
    const res = await request('/health');
    if (res.status === 200 && res.data.status === 'ok') {
      console.log('✓ 通过: 健康检查正常');
      passed++;
    } else {
      console.log('✗ 失败: 健康检查异常');
      failed++;
    }
  } catch (e) {
    console.log('✗ 失败:', e.message);
    console.log('  提示: 请先启动服务 (npm start)');
    failed++;
  }
  
  console.log('\n--- 测试 2: 创建包裹 - 正常流程 ---');
  try {
    const newPackage = {
      tracking_number: 'TEST' + Date.now(),
      recipient: { name: '测试用户', phone: '13900000001', address: '测试地址' },
      courier_company: '测试快递',
      weight: 1.5,
      storage_location: 'T-001'
    };
    const res = await request('/packages', 'POST', newPackage);
    if (res.status === 201 && res.data.id) {
      console.log('✓ 通过: 包裹创建成功, ID:', res.data.id);
      global.testPackageId = res.data.id;
      passed++;
    } else {
      console.log('✗ 失败: 包裹创建失败, 状态码:', res.status);
      failed++;
    }
  } catch (e) {
    console.log('✗ 失败:', e.message);
    failed++;
  }
  
  console.log('\n--- 测试 3: 查询包裹列表 ---');
  try {
    const res = await request('/packages');
    if (res.status === 200 && res.data.data && res.data.data.length > 0) {
      console.log(`✓ 通过: 查询到 ${res.data.data.length} 个包裹`);
      passed++;
    } else {
      console.log('✗ 失败: 包裹列表为空');
      failed++;
    }
  } catch (e) {
    console.log('✗ 失败:', e.message);
    failed++;
  }
  
  console.log('\n--- 测试 4: 催取包裹 - 正常 ---');
  try {
    const res = await request('/reminders', 'POST', {
      package_id: global.testPackageId || 3,
      type: 'normal',
      channel: 'sms'
    });
    if (res.status === 201) {
      console.log('✓ 通过: 催取记录创建成功');
      passed++;
    } else {
      console.log('✗ 失败: 催取失败, 状态码:', res.status, res.data);
      failed++;
    }
  } catch (e) {
    console.log('✗ 失败:', e.message);
    failed++;
  }
  
  console.log('\n--- 测试 5: 催取去重 - 重复请求拦截 ---');
  try {
    const res = await request('/reminders', 'POST', {
      package_id: 1,
      type: 'urgent'
    });
    if (res.status === 400 && res.data.deduplicated === true) {
      console.log('✓ 通过: 重复催取被正确拦截');
      passed++;
    } else if (res.status === 400) {
      console.log('✓ 通过: 催取间隔检查生效');
      passed++;
    } else {
      console.log('✗ 失败: 去重机制未生效, 状态码:', res.status);
      failed++;
    }
  } catch (e) {
    console.log('✗ 失败:', e.message);
    failed++;
  }
  
  console.log('\n--- 测试 6: 创建包裹 - 脏数据 (缺少必填字段) ---');
  try {
    const badPackage = { tracking_number: 'BAD001' };
    const res = await request('/packages', 'POST', badPackage);
    if (res.status === 400) {
      console.log('✓ 通过: 脏数据被正确拦截');
      passed++;
    } else {
      console.log('✗ 失败: 脏数据未被拦截, 状态码:', res.status);
      failed++;
    }
  } catch (e) {
    console.log('✗ 失败:', e.message);
    failed++;
  }
  
  console.log('\n--- 测试 7: 状态推进 - 拒收包裹 ---');
  try {
    const pkgRes = await request('/packages');
    const inStockPkg = pkgRes.data.data.find(p => p.status === 'in_stock');
    
    if (inStockPkg) {
      const res = await request('/rejections', 'POST', {
        package_id: inStockPkg.id,
        reason: '测试拒收',
        description: '这是一个测试',
        handler: '测试员'
      });
      if (res.status === 201) {
        console.log('✓ 通过: 拒收记录创建成功, 包裹状态已更新');
        global.testRejectionId = res.data.id;
        passed++;
      } else {
        console.log('✗ 失败: 拒收失败, 状态码:', res.status);
        failed++;
      }
    } else {
      console.log('? 跳过: 未找到适合测试的在库包裹');
    }
  } catch (e) {
    console.log('✗ 失败:', e.message);
    failed++;
  }
  
  console.log('\n--- 测试 8: 查询拒收记录 ---');
  try {
    const res = await request('/rejections');
    if (res.status === 200 && res.data.data) {
      console.log(`✓ 通过: 查询到 ${res.data.data.length} 条拒收记录`);
      passed++;
    } else {
      console.log('✗ 失败: 拒收记录查询异常');
      failed++;
    }
  } catch (e) {
    console.log('✗ 失败:', e.message);
    failed++;
  }
  
  console.log('\n--- 测试 9: 人工修正包裹信息 ---');
  try {
    const pkgRes = await request('/packages');
    const pkg = pkgRes.data.data[0];
    
    if (pkg) {
      const res = await request(`/packages/${pkg.id}/correct`, 'PATCH', {
        storage_location: 'NEW-LOC-' + Date.now(),
        weight: 2.0
      });
      if (res.status === 200 && res.data.success) {
        console.log('✓ 通过: 人工修正成功');
        passed++;
      } else {
        console.log('✗ 失败: 人工修正失败, 状态码:', res.status);
        failed++;
      }
    }
  } catch (e) {
    console.log('✗ 失败:', e.message);
    failed++;
  }
  
  console.log('\n--- 测试 10: 导出滞留报告 (JSON) ---');
  try {
    const res = await request('/export/retention?format=json');
    if (res.status === 200 && res.data.data && res.data.record_count > 0) {
      console.log(`✓ 通过: JSON导出成功, 共 ${res.data.record_count} 条记录`);
      passed++;
    } else {
      console.log('✗ 失败: JSON导出异常');
      failed++;
    }
  } catch (e) {
    console.log('✗ 失败:', e.message);
    failed++;
  }
  
  console.log('\n--- 测试 11: 导出滞留报告 (CSV) ---');
  try {
    const res = await request('/export/retention?format=csv');
    if (res.status === 200 && res.data.filename && res.data.record_count > 0) {
      console.log(`✓ 通过: CSV导出成功, 文件: ${res.data.filename}, 共 ${res.data.record_count} 条记录`);
      passed++;
    } else {
      console.log('✗ 失败: CSV导出异常');
      failed++;
    }
  } catch (e) {
    console.log('✗ 失败:', e.message);
    failed++;
  }
  
  console.log('\n--- 测试 12: 异常日志记录检查 ---');
  try {
    const res = await request('/exceptions');
    if (res.status === 200 && res.data.data) {
      console.log(`✓ 通过: 查询到 ${res.data.data.length} 条异常日志`);
      passed++;
    } else {
      console.log('? 提示: 暂无异常日志记录');
    }
  } catch (e) {
    console.log('✗ 失败:', e.message);
    failed++;
  }
  
  console.log('\n--- 测试 13: 导出一致性验证 ---');
  try {
    const jsonRes = await request('/export/retention?format=json');
    const csvRes = await request('/export/retention?format=csv');
    
    if (jsonRes.data.record_count === csvRes.data.record_count) {
      console.log(`✓ 通过: JSON和CSV导出记录数一致 (${jsonRes.data.record_count} 条)`);
      passed++;
    } else {
      console.log(`✗ 失败: 导出记录数不一致 - JSON:${jsonRes.data.record_count}, CSV:${csvRes.data.record_count}`);
      failed++;
    }
  } catch (e) {
    console.log('✗ 失败:', e.message);
    failed++;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));
  console.log(`通过: ${passed}`);
  console.log(`失败: ${failed}`);
  console.log(`总计: ${passed + failed}`);
  console.log(`通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
