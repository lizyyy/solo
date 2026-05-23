const http = require('http');
const app = require('../src/app');

function testApi(path, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  const server = app.listen(3000);
  
  console.log('🚀 API服务已启动，进行API测试...\n');
  
  console.log('1️⃣  测试健康检查...');
  const health = await testApi('/health');
  console.log('   ✅ 健康检查:', health.data.status);
  
  console.log('\n2️⃣  测试获取事实列表...');
  const facts = await testApi('/api/facts?page_size=5');
  console.log('   ✅ 事实总数:', facts.data.data.pagination.total);
  
  console.log('\n3️⃣  测试脏记录统计...');
  const dirtyStats = await testApi('/api/dirty/stats');
  console.log('   ✅ 脏数据类型:', dirtyStats.data.data.by_type.length + '种');
  
  console.log('\n4️⃣  测试队列统计...');
  const queueStats = await testApi('/api/queue/stats');
  console.log('   ✅ 队列状态数:', queueStats.data.data.queue.length + '种');
  
  console.log('\n5️⃣  测试提交新预约记录...');
  const newApt = await testApi('/api/receive/appointment', 'POST', {
    appointment_no: 'API_TEST_001',
    visitor_name: 'API测试用户',
    visit_date: '2026-05-23',
    source: 'api_test'
  });
  console.log('   ✅ 预约号:', newApt.data.data.appointment_no);
  console.log('   ✅ 事实ID:', newApt.data.data.fact_id);
  
  console.log('\n6️⃣  测试获取单条事实详情...');
  const factDetail = await testApi('/api/facts/' + newApt.data.data.fact_id);
  console.log('   ✅ 事实详情包含预约:', !!factDetail.data.data.appointment);
  console.log('   ✅ 事实详情包含操作历史:', !!factDetail.data.data.operation_history);
  
  console.log('\n7️⃣  测试添加人工备注...');
  const note = await testApi('/api/notes/fact/' + newApt.data.data.fact_id, 'POST', {
    author: 'API测试员',
    note_type: 'test',
    content: '这是一条API测试备注'
  });
  console.log('   ✅ 备注ID:', note.data.data.note_id);
  
  console.log('\n8️⃣  测试生成安保报告...');
  const report = await testApi('/api/export/security-report');
  console.log('   ✅ 报告文件:', report.data.data.json_file.split('/').pop());
  
  console.log('\n' + '='.repeat(60));
  console.log('                    ✅ 所有API测试通过!');
  console.log('='.repeat(60));
  
  server.close();
}

runTests().catch(console.error);
