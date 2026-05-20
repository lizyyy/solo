const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('公交失物招领系统 API 测试');
  console.log('='.repeat(60));

  const baseOptions = {
    hostname: 'localhost',
    port: 3000,
    headers: { 'Content-Type': 'application/json' }
  };

  try {
    console.log('\n[1/8] 测试健康检查接口...');
    const healthRes = await makeRequest({ ...baseOptions, path: '/health', method: 'GET' });
    console.log(`  状态: ${healthRes.statusCode}`, healthRes.data);

    console.log('\n[2/8] 创建失物批次...');
    const batch1 = await makeRequest(
      { ...baseOptions, path: '/api/batches', method: 'POST' },
      JSON.stringify({ batchType: 'lost_items', sourceFile: 'sample_lost_items.csv', createdBy: '测试员A', remark: '1月15日失物数据' })
    );
    console.log(`  状态: ${batch1.statusCode}`, batch1.data);
    const batchId1 = batch1.data.data?.batchId;

    console.log('\n[3/8] 创建线路班次批次...');
    const batch2 = await makeRequest(
      { ...baseOptions, path: '/api/batches', method: 'POST' },
      JSON.stringify({ batchType: 'route_schedules', sourceFile: 'sample_route_schedules.json', createdBy: '测试员A', remark: '线路班次数据' })
    );
    console.log(`  状态: ${batch2.statusCode}`, batch2.data);

    console.log('\n[4/8] 查询批次列表...');
    const batchesRes = await makeRequest({ ...baseOptions, path: '/api/batches?page=1&pageSize=10', method: 'GET' });
    console.log(`  状态: ${batchesRes.statusCode}`, `共 ${batchesRes.data.data?.total || 0} 条记录`);

    console.log('\n[5/8] 查询物品列表...');
    const itemsRes = await makeRequest({ ...baseOptions, path: '/api/items?page=1&pageSize=10', method: 'GET' });
    console.log(`  状态: ${itemsRes.statusCode}`, `共 ${itemsRes.data.data?.total || 0} 条记录`);

    console.log('\n[6/8] 按线路查询物品...');
    const routeRes = await makeRequest({ ...baseOptions, path: '/api/query/by-route?routeNo=1', method: 'GET' });
    console.log(`  状态: ${routeRes.statusCode}`, `1路公交物品: ${routeRes.data.data?.items?.length || 0} 件`);

    console.log('\n[7/8] 按司机查询物品...');
    const driverRes = await makeRequest({ ...baseOptions, path: '/api/query/by-driver?driverName=' + encodeURIComponent('张三'), method: 'GET' });
    console.log(`  状态: ${driverRes.statusCode}`, `张三上交物品: ${driverRes.data.data?.length || 0} 件`);

    console.log('\n[8/8] 执行同名物品检查...');
    const sameNameRes = await makeRequest(
      { ...baseOptions, path: '/api/tasks/check-same-name', method: 'POST' },
      JSON.stringify({})
    );
    console.log(`  状态: ${sameNameRes.statusCode}`, sameNameRes.data);

    console.log('\n' + '='.repeat(60));
    console.log('API 测试完成!');
    console.log('='.repeat(60));
    console.log('\n后续操作建议:');
    console.log('1. 上传CSV文件: curl -X POST -F "file=@examples/sample_lost_items.csv" -F "batchId=1" -F "operator=测试员A" http://localhost:3000/api/upload/lost-items');
    console.log('2. 上传JSON文件: curl -X POST -F "file=@examples/sample_route_schedules.json" -F "batchId=2" -F "operator=测试员A" http://localhost:3000/api/upload/route-schedules');
    console.log('3. 导出数据: curl http://localhost:3000/api/export -o output.csv');

  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('请先启动服务: npm start');
  }
}

runTests();
