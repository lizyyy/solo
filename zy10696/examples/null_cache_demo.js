const mockCache = require('../src/services/mockCacheService');
const http = require('http');

const API_BASE = 'http://localhost:3000/api/cache';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function apiCall(method, path, data = null) {
  const url = new URL(API_BASE + path);
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  return request(options, data);
}

async function runNullCacheDemo() {
  console.log('========================================');
  console.log('场景1: 空值缓存降级与恢复演示');
  console.log('========================================\n');

  console.log('1. 设置空值缓存');
  mockCache.set('user:123', null);
  console.log('   缓存状态:', mockCache.getStats(), '\n');

  console.log('2. 发现热点空值缓存Key, 创建降级记录');
  const degradeResult = await apiCall('POST', '/degrade', {
    cache_key: 'v1:user:123',
    business_line: '用户中心',
    degrade_reason: '空值缓存导致穿透, 热点Key流量过大',
    executor: '张三'
  });
  console.log('   降级结果:', JSON.stringify(degradeResult, null, 2), '\n');

  console.log('3. 查询降级记录');
  const records = await apiCall('GET', '/records');
  console.log('   记录数量:', records.data.length);
  console.log('   最新记录:', JSON.stringify(records.data[0], null, 2), '\n');

  console.log('4. 申请恢复');
  const recordId = degradeResult.data.id;
  const restoreResult = await apiCall('POST', `/restore/${recordId}`, {
    applicant: '李四'
  });
  console.log('   恢复申请结果:', JSON.stringify(restoreResult, null, 2), '\n');

  console.log('5. 模拟旧空值缓存被命中');
  const cacheResult = mockCache.get('user:123');
  if (cacheResult && cacheResult.isNullCache) {
    const hitResult = await apiCall('POST', '/cache-hit', {
      cache_key: 'v1:user:123',
      value_type: 'null',
      is_null_cache: true
    });
    console.log('   命中空值缓存, 自动标记待清理:', JSON.stringify(hitResult, null, 2), '\n');
  }

  console.log('6. 查询待清理任务');
  const tasks = await apiCall('GET', '/cleanup-tasks?status=pending');
  console.log('   待清理任务:', JSON.stringify(tasks.data, null, 2), '\n');

  console.log('7. 确认清理完成');
  const taskId = tasks.data[0].id;
  const confirmResult = await apiCall('POST', `/cleanup/${taskId}/confirm`, {
    operator: '王五'
  });
  console.log('   确认清理结果:', JSON.stringify(confirmResult, null, 2), '\n');

  console.log('8. 最终状态验证');
  const finalRecords = await apiCall('GET', `/records/${recordId}`);
  console.log('   降级记录最终状态:', JSON.stringify(finalRecords.data, null, 2), '\n');

  console.log('========================================\n');
}

async function runPrefixChangeDemo() {
  console.log('========================================');
  console.log('场景2: Key前缀变更导致旧缓存失效演示');
  console.log('========================================\n');

  console.log('1. 当前缓存前缀:', mockCache.getKeyPrefix());
  mockCache.set('product:456', { id: 456, name: '商品A' });
  console.log('   缓存状态:', mockCache.getStats(), '\n');

  console.log('2. 创建降级记录（业务线切换）');
  const degradeResult = await apiCall('POST', '/degrade', {
    cache_key: 'v1:product:456',
    business_line: '商品中心',
    degrade_reason: 'Key前缀即将变更, 旧缓存需要清理',
    executor: '赵六'
  });
  const recordId = degradeResult.data.id;
  console.log('   降级记录ID:', recordId, '\n');

  console.log('3. 申请恢复');
  await apiCall('POST', `/restore/${recordId}`, {
    applicant: '钱七'
  });
  console.log('   已申请恢复\n');

  console.log('4. 变更Key前缀');
  mockCache.setKeyPrefix('v2:');
  console.log('   新前缀:', mockCache.getKeyPrefix(), '\n');

  console.log('5. 模拟旧前缀缓存被访问');
  const oldKeyHit = await apiCall('POST', '/cache-hit', {
    cache_key: 'v1:product:456',
    value_type: 'object',
    is_null_cache: false
  });
  console.log('   旧Key命中, 自动标记清理:', JSON.stringify(oldKeyHit, null, 2), '\n');

  console.log('6. 再次访问旧Key');
  await apiCall('POST', '/cache-hit', {
    cache_key: 'v1:product:456',
    value_type: 'object',
    is_null_cache: false
  });
  console.log('   第二次命中, 命中计数增加\n');

  console.log('7. 查询清理任务详情');
  const tasks = await apiCall('GET', '/cleanup-tasks');
  console.log('   清理任务命中次数:', tasks.data[0].hit_count, '\n');

  console.log('========================================\n');
}

async function main() {
  console.log('\n等待API服务启动...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    await runNullCacheDemo();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await runPrefixChangeDemo();
    
    console.log('演示完成!');
    console.log('导出数据可在 exports/ 目录查看');
  } catch (error) {
    console.error('演示失败:', error.message);
    console.log('请先确保API服务已启动: npm start');
  }
}

if (require.main === module) {
  main();
}

module.exports = { runNullCacheDemo, runPrefixChangeDemo };