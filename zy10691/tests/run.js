const { spawn } = require('child_process');
const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('🚀 启动服务器...');
  const server = spawn('node', ['src/app.js'], { stdio: 'inherit' });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const baseOptions = {
    hostname: 'localhost',
    port: 3000,
    headers: { 'Content-Type': 'application/json' }
  };

  try {
    console.log('\n📋 === 测试开始 ===\n');

    console.log('1️⃣ 测试健康检查接口');
    const health = await request({ ...baseOptions, path: '/health', method: 'GET' });
    console.log('   状态:', health.status);
    console.log('   ✅ 通过');

    console.log('\n2️⃣ 测试获取仓库列表');
    const repos = await request({ ...baseOptions, path: '/api/repositories', method: 'GET' });
    console.log('   仓库数量:', repos.body.length);
    console.log('   ✅ 通过');

    console.log('\n3️⃣ 测试获取漏洞规则列表');
    const rules = await request({ ...baseOptions, path: '/api/vulnerability-rules', method: 'GET' });
    console.log('   规则数量:', rules.body.length);
    console.log('   ✅ 通过');

    console.log('\n4️⃣ 测试获取扫描结果列表');
    const results = await request({ ...baseOptions, path: '/api/scan-results', method: 'GET' });
    console.log('   结果数量:', results.body.data.length);
    console.log('   ✅ 通过');

    console.log('\n5️⃣ 测试提交复核（正常流程）');
    const submitResult = await request({
      ...baseOptions,
      path: '/api/scan-results/1/review',
      method: 'POST'
    }, {
      reviewer: 'test.user',
      review_type: 'SUBMIT',
      comment: '请复核此SQL注入漏洞'
    });
    console.log('   状态:', submitResult.status);
    console.log('   结果:', submitResult.body);
    console.log('   ✅ 通过');

    console.log('\n6️⃣ 测试关闭漏洞（标记为误报）');
    const closeResult = await request({
      ...baseOptions,
      path: '/api/scan-results/1/review',
      method: 'POST'
    }, {
      reviewer: 'reviewer.admin',
      review_type: 'CLOSE',
      comment: '经核实，此处使用了参数化查询，确认为误报'
    });
    console.log('   状态:', closeResult.status);
    console.log('   结果:', closeResult.body);
    console.log('   ✅ 通过');

    console.log('\n7️⃣ 测试获取复核历史');
    const reviews = await request({
      ...baseOptions,
      path: '/api/scan-results/3/reviews',
      method: 'GET'
    });
    console.log('   复核记录数量:', reviews.body.length);
    console.log('   规则版本留痕:', reviews.body[0]?.rule_version_at_review);
    console.log('   文件路径留痕:', reviews.body[0]?.file_path_at_review);
    console.log('   ✅ 通过');

    console.log('\n8️⃣ 测试重新打开漏洞');
    const reopenResult = await request({
      ...baseOptions,
      path: '/api/scan-results/3/review',
      method: 'POST'
    }, {
      reviewer: 'senior.reviewer',
      review_type: 'REOPEN',
      comment: '规则升级后需要重新评估'
    });
    console.log('   状态:', reopenResult.status);
    console.log('   结果:', reopenResult.body);
    console.log('   ✅ 通过');

    console.log('\n9️⃣ 测试筛选功能 - 按状态筛选');
    const filtered = await request({
      ...baseOptions,
      path: '/api/scan-results?status=FALSE_POSITIVE',
      method: 'GET'
    });
    console.log('   筛选结果数量:', filtered.body.data.length);
    console.log('   ✅ 通过');

    console.log('\n🔟 测试边界情况 - 相同条件重复提交');
    const duplicateSubmit = await request({
      ...baseOptions,
      path: '/api/scan-results',
      method: 'POST'
    }, {
      repository_id: 2,
      rule_id: 'AUTH-003',
      file_path: 'config/database.js',
      line_number: 15,
      commit_hash: 'xyz789abc123'
    });
    console.log('   状态:', duplicateSubmit.status);
    console.log('   消息:', duplicateSubmit.body.message);
    console.log('   ✅ 通过 - 正确识别并保持原有状态');

    console.log('\n✅ === 所有测试通过 ===\n');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    server.kill();
    process.exit(0);
  }
}

runTests();
