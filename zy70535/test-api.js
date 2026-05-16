const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: data }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function test() {
  try {
    console.log('1. 健康检查...');
    const health = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'GET'
    });
    console.log('状态:', health.status);
    console.log('响应:', health.data);

    console.log('\n2. 创建解析规则...');
    const ruleData = JSON.stringify({
      name: "用户数据校验规则",
      columns: [
        { name: "name", required: true, minLength: 2 },
        { name: "email", required: true, type: "email" },
        { name: "age", required: true, type: "number" }
      ]
    });
    const rule = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/rules',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(ruleData)
      }
    }, ruleData);
    console.log('状态:', rule.status);
    console.log('响应:', rule.data);

    if (rule.status === 201) {
      const ruleId = JSON.parse(rule.data).id;
      console.log('\n3. 查询规则列表...');
      const rules = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/rules',
        method: 'GET'
      });
      console.log('状态:', rules.status);
      console.log('规则数量:', JSON.parse(rules.data).length);
    }

    console.log('\nAPI 测试完成!');
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

setTimeout(test, 1000);
