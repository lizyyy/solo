const http = require('http');

const HOST = 'localhost';
const PORT = 3000;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'x-operator': 'test-user'
      }
    };
    
    if (bodyStr) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data, error: e });
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('HTTP请求错误:', err.message);
      reject(err);
    });
    
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

function get(path) {
  const encodedPath = encodeURI(path);
  return request('GET', encodedPath);
}

function post(path, body) {
  return request('POST', path, body);
}

function put(path, body) {
  return request('PUT', path, body);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`断言失败: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  console.log('等待服务启动...');
  for (let i = 0; i < 10; i++) {
    try {
      const res = await get('/api/health');
      if (res.statusCode === 200) {
        console.log('服务已就绪');
        return true;
      }
    } catch (e) {
      // 忽略错误，继续重试
    }
    await sleep(1000);
  }
  throw new Error('服务启动超时');
}

async function runTests() {
  console.log('=== 公交失物招领 API 测试 ===\n');
  
  await waitForServer();
  
  let testItemId = null;
  let testClaimId = null;
  let testRouteId = null;
  
  try {
    console.log('\n--- 1. 基础测试 ---');
    
    const health = await get('/api/health');
    assert(health.statusCode === 200 && health.data.success, '健康检查正常');
    
    const rules = await get('/api/rules');
    assert(rules.statusCode === 200 && rules.data.success, '获取规则列表正常');
    assert(rules.data.data.length > 0, '默认规则已初始化');
    
    const storagePoints = await get('/api/storage-points');
    assert(storagePoints.statusCode === 200 && storagePoints.data.success, '获取保管点正常');
    assert(storagePoints.data.data.length >= 3, '默认保管点已初始化');
    
    const defaultStorage = storagePoints.data.data[0];
    
    console.log('\n--- 2. 线路车辆绑定测试 ---');
    
    const newRoute = await post('/api/bus-routes', {
      route_number: '101',
      vehicle_number: '京A12345',
      driver_name: '张师傅'
    });
    assert(newRoute.statusCode === 201 && newRoute.data.success, '创建线路车辆成功');
    testRouteId = newRoute.data.data.id;
    
    const routes = await get('/api/bus-routes');
    assert(routes.statusCode === 200 && routes.data.success, '获取线路列表正常');
    
    console.log('\n--- 3. 失物登记测试 ---');
    
    const itemResult = await post('/api/lost-items', {
      item_name: '黑色钱包',
      description: '内有身份证和银行卡',
      item_category: '钱包',
      photos: ['http://example.com/photo1.jpg', 'http://example.com/photo2.jpg'],
      driver_name: '张师傅',
      found_time: new Date().toISOString(),
      current_storage_point_id: defaultStorage.id,
      estimated_value: 500,
      special_marks: '左上角有磨损'
    });
    assert(itemResult.statusCode === 201 && itemResult.data.success, '失物登记成功');
    testItemId = itemResult.data.data.id;
    assert(itemResult.data.data.status === 'REGISTERED', '初始状态为REGISTERED');
    
    const itemDetail = await get(`/api/lost-items/${testItemId}`);
    assert(itemDetail.statusCode === 200 && itemDetail.data.success, '获取失物详情正常');
    
    console.log('\n--- 4. 绑定线路车辆测试 ---');
    
    const bindResult = await post(`/api/lost-items/${testItemId}/bind-route`, {
      bus_route_id: testRouteId
    });
    assert(bindResult.statusCode === 200 && bindResult.data.success, '绑定线路车辆成功');
    assert(bindResult.data.data.bus_route_id === testRouteId, '线路车辆ID已更新');
    
    console.log('\n--- 5. 保管流转测试 ---');
    
    const secondStorage = storagePoints.data.data[1];
    const transferResult = await post(`/api/lost-items/${testItemId}/transfer`, {
      to_storage_point_id: secondStorage.id,
      reason: '物品分类存放',
      notes: '需要转到东区中转站'
    });
    assert(transferResult.statusCode === 200 && transferResult.data.success, '发起保管流转成功');
    assert(transferResult.data.data.status === 'IN_TRANSIT', '流转中状态为IN_TRANSIT');
    assert(transferResult.data.data.current_storage_point_id === secondStorage.id, '保管点已更新');
    
    const arrivalResult = await post(`/api/lost-items/${testItemId}/confirm-arrival`, {});
    assert(arrivalResult.statusCode === 200 && arrivalResult.data.success, '确认到达成功');
    assert(arrivalResult.data.data.status === 'IN_STORAGE', '到达后状态为IN_STORAGE');
    
    console.log('\n--- 6. 认领申请测试 ---');
    
    const claimResult = await post('/api/claims', {
      lost_item_id: testItemId,
      claimant_name: '李先生',
      claimant_phone: '13800138000',
      claimant_id_number: '110101199001011234',
      claim_description: '上周三乘坐101路时丢失的，钱包里有我的身份证',
      proof_photos: ['http://example.com/proof1.jpg']
    });
    assert(claimResult.statusCode === 201 && claimResult.data.success, '创建认领申请成功');
    testClaimId = claimResult.data.data.id;
    assert(claimResult.data.data.status === 'PENDING', '认领初始状态为PENDING');
    
    const itemAfterClaim = await get(`/api/lost-items/${testItemId}`);
    assert(itemAfterClaim.data.data.status === 'CLAIM_PENDING', '失物状态变为CLAIM_PENDING');
    
    const duplicateClaim = await post('/api/claims', {
      lost_item_id: testItemId,
      claimant_name: '王先生',
      claimant_phone: '13900139000'
    });
    assert(duplicateClaim.statusCode === 400, '重复认领被拒绝');
    
    console.log('\n--- 7. 认领审核测试 ---');
    
    const reviewResult = await post(`/api/claims/${testClaimId}/review`, {
      approved: true,
      review_notes: '身份核实无误，物品描述匹配'
    });
    assert(reviewResult.statusCode === 200 && reviewResult.data.success, '审核通过成功');
    assert(reviewResult.data.data.status === 'APPROVED', '认领状态变为APPROVED');
    
    const itemAfterReview = await get(`/api/lost-items/${testItemId}`);
    assert(itemAfterReview.data.data.status === 'CLAIMED', '失物状态变为CLAIMED');
    
    const pickupResult = await post(`/api/claims/${testClaimId}/confirm-pickup`, {});
    assert(pickupResult.statusCode === 200 && pickupResult.data.success, '确认领取成功');
    assert(pickupResult.data.data.status === 'PICKED_UP', '认领状态变为PICKED_UP');
    
    console.log('\n--- 8. 历史记录查询测试 ---');
    
    const history = await get(`/api/lost-items/${testItemId}/history`);
    assert(history.statusCode === 200 && history.data.success, '获取完整历史成功');
    assert(history.data.data.transfers.length > 0, '包含流转记录');
    assert(history.data.data.claims.length > 0, '包含认领记录');
    assert(history.data.data.auditLogs.length > 0, '包含审计日志');
    
    console.log('\n--- 9. 查询接口测试 ---');
    
    const queryByStatus = await get('/api/lost-items?status=CLAIMED');
    assert(queryByStatus.statusCode === 200 && queryByStatus.data.success, '按状态查询正常');
    
    const queryByName = await get('/api/lost-items?item_name=钱包');
    assert(queryByName.statusCode === 200 && queryByName.data.success, '按名称模糊查询正常');
    
    const queryByRoute = await get('/api/lost-items?route_number=101');
    assert(queryByRoute.statusCode === 200 && queryByRoute.data.success, '按线路查询正常');
    
    const auditLogs = await get(`/api/audit-logs?entity_type=lost_items&entity_id=${testItemId}`);
    assert(auditLogs.statusCode === 200 && auditLogs.data.success, '审计日志查询正常');
    
    console.log('\n--- 10. 边界情况测试 ---');
    
    const invalidItem = await post('/api/lost-items', {
      item_name: '测试物品'
    });
    assert(invalidItem.statusCode === 400, '缺少照片的登记被拒绝');
    
    const notFoundItem = await get('/api/lost-items/invalid-id-123');
    assert(notFoundItem.statusCode === 404, '不存在的失物返回404');
    
    const claimOnClaimedItem = await post('/api/claims', {
      lost_item_id: testItemId,
      claimant_name: '测试用户',
      claimant_phone: '10086'
    });
    assert(claimOnClaimedItem.statusCode === 400, '已认领物品无法再次申请');
    
    const updateRule = await put('/api/rules/overdue_notice_days', {
      value: '20'
    });
    assert(updateRule.statusCode === 200 && updateRule.data.success, '更新规则成功');
    assert(updateRule.data.data.value === '20', '规则值已更新');
    
    const rulesAfterUpdate = await get('/api/rules');
    const updatedRule = rulesAfterUpdate.data.data.find(r => r.name === 'overdue_notice_days');
    assert(updatedRule && updatedRule.value === '20', '规则更新持久化成功');
    
    const transferOnClaimed = await post(`/api/lost-items/${testItemId}/transfer`, {
      to_storage_point_id: defaultStorage.id,
      reason: '测试'
    });
    assert(transferOnClaimed.statusCode === 400, '已认领物品无法流转');
    
    console.log('\n--- 11. 第二件失物流转测试 ---');
    
    const storagePoints2 = await get('/api/storage-points');
    const storage001 = storagePoints2.data.data.find(s => s.id === 'storage_001');
    const storage002 = storagePoints2.data.data.find(s => s.id === 'storage_002');
    
    const item2 = await post('/api/lost-items', {
      item_name: '手机',
      description: 'iPhone 14',
      item_category: '电子设备',
      photos: ['http://example.com/phone.jpg'],
      found_time: new Date().toISOString(),
      current_storage_point_id: storage001.id
    });
    assert(item2.statusCode === 201 && item2.data.success, '第二件失物登记成功');
    
    const transfer2 = await post(`/api/lost-items/${item2.data.data.id}/transfer`, {
      to_storage_point_id: storage002.id,
      reason: '贵重物品专项保管'
    });
    assert(transfer2.statusCode === 200 && transfer2.data.success, '第二件失物流转成功');
    
    const arrival2 = await post(`/api/lost-items/${item2.data.data.id}/confirm-arrival`, {});
    assert(arrival2.statusCode === 200 && arrival2.data.success, '第二件失物确认到达成功');
    assert(arrival2.data.data.status === 'IN_STORAGE', '第二件失物入库成功');
    
    console.log('\n--- 12. 统计验证 ---');
    
    const allItems = await get('/api/lost-items');
    assert(allItems.data.data.length >= 2, '系统中至少有2件失物');
    
    const allClaims = await get('/api/claims');
    assert(allClaims.data.data.length >= 1, '系统中至少有1条认领记录');
    
    const pendingClaims = await get('/api/claims?status=PENDING');
    assert(pendingClaims.data.data.length === 0, '没有待审核的认领');
    
    console.log('\n=== 所有测试通过！ ===\n');
    return true;
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    return false;
  }
}

runTests().then(success => {
  process.exit(success ? 0 : 1);
});
