const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: { raw: data } });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function get(path) {
  const url = new URL(path, BASE_URL);
  return request({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
}

function post(path, body) {
  const url = new URL(path, BASE_URL);
  const bodyStr = JSON.stringify(body);
  return request({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr)
    }
  }, body);
}

function put(path, body) {
  const url = new URL(path, BASE_URL);
  const bodyStr = JSON.stringify(body);
  return request({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr)
    }
  }, body);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('========================================');
  console.log('  高校实验动物笼位分配API测试');
  console.log('========================================\n');
  
  try {
    console.log('1. 检查系统健康状态...');
    const health = await get('/health');
    console.log(`   状态码: ${health.statusCode}`);
    console.log(`   健康状态: ${health.data.status}\n`);
    
    console.log('2. 获取品系列表...');
    const strains = await get('/api/strains');
    console.log(`   状态码: ${strains.statusCode}`);
    console.log(`   品系数量: ${strains.data.data?.length || 0}`);
    if (strains.data.data?.length > 0) {
      console.log(`   示例品系: ${strains.data.data[0].code} - ${strains.data.data[0].name}\n`);
    }
    
    console.log('3. 获取隔离规则列表...');
    const isoRules = await get('/api/isolation-rules');
    console.log(`   状态码: ${isoRules.statusCode}`);
    console.log(`   隔离规则数量: ${isoRules.data.data?.length || 0}\n`);
    
    console.log('4. 获取笼位列表...');
    const cages = await get('/api/cages');
    console.log(`   状态码: ${cages.statusCode}`);
    console.log(`   笼位数量: ${cages.data.data?.length || 0}`);
    if (cages.data.data?.length > 0) {
      const available = cages.data.data.filter(c => c.status === 'available').length;
      console.log(`   可用笼位: ${available}\n`);
    }
    
    console.log('5. 获取动物列表...');
    const animals = await get('/api/animals');
    console.log(`   状态码: ${animals.statusCode}`);
    console.log(`   动物数量: ${animals.data.data?.length || 0}\n`);
    
    if (animals.data.data?.length > 0 && cages.data.data?.length > 0) {
      const animal = animals.data.data[0];
      const availableCage = cages.data.data.find(c => c.status === 'available');
      
      if (availableCage) {
        console.log('6. 测试创建分配记录（初始分配）...');
        const requestId = `TEST-ALLOC-${Date.now()}`;
        const createResult = await post('/api/allocations', {
          request_id: requestId,
          animal_id: animal.id,
          cage_id: availableCage.id,
          action: 'initial_allocation',
          reason: '测试初始分配',
          operator: 'test_user'
        });
        console.log(`   状态码: ${createResult.statusCode}`);
        console.log(`   成功: ${createResult.data.success}`);
        console.log(`   消息: ${createResult.data.message}`);
        
        if (createResult.data.success && createResult.data.data?.id) {
          const allocationId = createResult.data.data.id;
          console.log(`   分配记录ID: ${allocationId}\n`);
          
          console.log('7. 测试幂等性（重复提交相同请求）...');
          const duplicateResult = await post('/api/allocations', {
            request_id: requestId,
            animal_id: animal.id,
            cage_id: availableCage.id,
            action: 'initial_allocation',
            reason: '测试初始分配',
            operator: 'test_user'
          });
          console.log(`   状态码: ${duplicateResult.statusCode}`);
          console.log(`   幂等性: ${duplicateResult.data.idempotent ? '是' : '否'}`);
          console.log(`   消息: ${duplicateResult.data.message}\n`);
          
          console.log('8. 测试状态推进（pending -> validating）...');
          const advance1 = await post(`/api/allocations/${allocationId}/advance`, {
            to_status: 'validating',
            reason: '开始验证',
            operator: 'test_user'
          });
          console.log(`   状态码: ${advance1.statusCode}`);
          console.log(`   成功: ${advance1.data.success}`);
          if (advance1.data.transition) {
            console.log(`   状态转换: ${advance1.data.transition.from} -> ${advance1.data.transition.to}\n`);
          }
          
          console.log('9. 测试状态推进（validating -> approved）...');
          const advance2 = await post(`/api/allocations/${allocationId}/advance`, {
            to_status: 'approved',
            reason: '验证通过',
            operator: 'test_user'
          });
          console.log(`   状态码: ${advance2.statusCode}`);
          console.log(`   成功: ${advance2.data.success}\n`);
          
          console.log('10. 测试状态推进（approved -> allocated）...');
          const advance3 = await post(`/api/allocations/${allocationId}/advance`, {
            to_status: 'allocated',
            reason: '完成分配',
            operator: 'test_user'
          });
          console.log(`   状态码: ${advance3.statusCode}`);
          console.log(`   成功: ${advance3.data.success}\n`);
          
          console.log('11. 测试无效状态转换...');
          const invalidAdvance = await post(`/api/allocations/${allocationId}/advance`, {
            to_status: 'pending',
            reason: '无效转换测试',
            operator: 'test_user'
          });
          console.log(`   状态码: ${invalidAdvance.statusCode}`);
          console.log(`   成功: ${invalidAdvance.data.success}`);
          console.log(`   错误代码: ${invalidAdvance.data.code || 'N/A'}\n`);
          
          console.log('12. 测试取消已分配记录...');
          const cancelResult = await post(`/api/allocations/${allocationId}/cancel`, {
            reason: '测试取消',
            operator: 'test_user'
          });
          console.log(`   状态码: ${cancelResult.statusCode}`);
          console.log(`   成功: ${cancelResult.data.success}`);
          console.log(`   消息: ${cancelResult.data.message}\n`);
          
          console.log('13. 测试分配记录详情（含历史）...');
          const detail = await get(`/api/allocations/${allocationId}`);
          console.log(`   状态码: ${detail.statusCode}`);
          console.log(`   历史记录数: ${detail.data.data?.history?.length || 0}\n`);
        }
      }
    }
    
    console.log('14. 获取看板数据...');
    const dashboard = await get('/api/reports/dashboard');
    console.log(`   状态码: ${dashboard.statusCode}`);
    if (dashboard.data.data) {
      console.log(`   总动物数: ${dashboard.data.data.overview?.totalAnimals}`);
      console.log(`   总笼位数: ${dashboard.data.data.overview?.totalCages}`);
      console.log(`   利用率: ${dashboard.data.data.overview?.utilizationRate}`);
      console.log(`   总分配记录: ${dashboard.data.data.allocations?.total}\n`);
    }
    
    console.log('15. 获取分配汇总报表...');
    const summary = await get('/api/reports/allocation-summary');
    console.log(`   状态码: ${summary.statusCode}`);
    console.log(`   总记录数: ${summary.data.data?.total || 0}\n`);
    
    console.log('16. 获取笼位利用率报表...');
    const utilization = await get('/api/reports/cage-utilization');
    console.log(`   状态码: ${utilization.statusCode}`);
    if (utilization.data.data?.stats) {
      console.log(`   总笼位: ${utilization.data.data.stats.total}`);
      console.log(`   已占用: ${utilization.data.data.stats.occupied}`);
      console.log(`   总体利用率: ${utilization.data.data.stats.overallUtilization}%\n`);
    }
    
    console.log('17. 获取品系隔离合规性报表...');
    const compliance = await get('/api/reports/strain-isolation-compliance');
    console.log(`   状态码: ${compliance.statusCode}`);
    if (compliance.data.data?.summary) {
      console.log(`   总分配数: ${compliance.data.data.summary.totalAllocations}`);
      console.log(`   合规数: ${compliance.data.data.summary.compliantAllocations}`);
      console.log(`   合规率: ${compliance.data.data.summary.complianceRate}\n`);
    }
    
    console.log('18. 测试边界情况 - 创建不存在的动物分配...');
    const invalidAnimal = await post('/api/allocations', {
      request_id: `TEST-INVALID-${Date.now()}`,
      animal_id: 99999,
      action: 'initial_allocation',
      operator: 'test_user'
    });
    console.log(`   状态码: ${invalidAnimal.statusCode}`);
    console.log(`   成功: ${invalidAnimal.data.success}`);
    console.log(`   错误代码: ${invalidAnimal.data.code || 'N/A'}\n`);
    
    console.log('========================================');
    console.log('  测试完成！');
    console.log('========================================');
    
  } catch (error) {
    console.error('\n测试执行失败:', error.message);
    console.error('请确保API服务已启动: npm start');
  }
}

runTests();
