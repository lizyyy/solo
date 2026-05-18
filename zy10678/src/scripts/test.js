const http = require('http');

const baseUrl = 'http://localhost:3000/api/no-fly';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
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
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getReferenceData() {
  console.log('📋 获取参考数据...');
  const result = await request({
    method: 'GET',
    hostname: 'localhost',
    port: 3000,
    path: '/api/no-fly/reference',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (result.status === 200) {
    return result.data.data;
  }
  throw new Error('获取参考数据失败');
}

async function runTests() {
  console.log('🧪 开始运行验收测试...\n');

  try {
    const refData = await getReferenceData();
    const routeId = refData.routes[0].id;
    const routeId2 = refData.routes[1].id;
    const applicantId = refData.applicants[0].id;

    console.log('✅ 参考数据获取成功\n');

    console.log('='.repeat(60));
    console.log('📝 测试场景 1: 完整状态流转');
    console.log('='.repeat(60));

    const createResult = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3000,
      path: '/api/no-fly',
      headers: { 'Content-Type': 'application/json' }
    }, {
      route_id: routeId,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 86400000).toISOString(),
      applicant_id: applicantId,
      reason: '验收测试-完整流转场景',
      cancel_older_tasks: true
    });

    console.log('1. 创建禁飞申请:', createResult.status === 201 ? '✅ 通过' : '❌ 失败');
    const recordId = createResult.data.data.id;

    const detailResult = await request({
      method: 'GET',
      hostname: 'localhost',
      port: 3000,
      path: `/api/no-fly/${recordId}`,
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('2. 查看详情:', detailResult.status === 200 ? '✅ 通过' : '❌ 失败');

    const approveResult = await request({
      method: 'PATCH',
      hostname: 'localhost',
      port: 3000,
      path: `/api/no-fly/${recordId}/status`,
      headers: { 'Content-Type': 'application/json' }
    }, {
      status: 'approved',
      operator: '系统管理员',
      remark: '审批通过，同意禁飞'
    });
    console.log('3. 审批通过:', approveResult.status === 200 ? '✅ 通过' : '❌ 失败');

    const restoreResult = await request({
      method: 'PATCH',
      hostname: 'localhost',
      port: 3000,
      path: `/api/no-fly/${recordId}/status`,
      headers: { 'Content-Type': 'application/json' }
    }, {
      status: 'restored',
      operator: '系统管理员',
      remark: '禁飞解除，恢复通航'
    });
    console.log('4. 恢复通航:', restoreResult.status === 200 ? '✅ 通过' : '❌ 失败');

    const historyResult = await request({
      method: 'GET',
      hostname: 'localhost',
      port: 3000,
      path: `/api/no-fly/${recordId}/history`,
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('5. 查看历史记录:', historyResult.status === 200 ? '✅ 通过' : '❌ 失败');
    console.log(`   历史记录条数: ${historyResult.data.data.length}\n`);

    console.log('='.repeat(60));
    console.log('🔀 测试场景 2: 时间冲突检测');
    console.log('='.repeat(60));

    const conflictCreate1 = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3000,
      path: '/api/no-fly',
      headers: { 'Content-Type': 'application/json' }
    }, {
      route_id: routeId2,
      start_time: new Date(Date.now() + 86400000 * 2).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 5).toISOString(),
      applicant_id: applicantId,
      reason: '冲突测试-记录1',
      cancel_older_tasks: true
    });
    console.log('1. 创建第一条记录:', conflictCreate1.status === 201 ? '✅ 通过' : '❌ 失败');

    await request({
      method: 'PATCH',
      hostname: 'localhost',
      port: 3000,
      path: `/api/no-fly/${conflictCreate1.data.data.id}/status`,
      headers: { 'Content-Type': 'application/json' }
    }, {
      status: 'approved',
      operator: '系统管理员',
      remark: '审批通过'
    });

    const conflictCreate2 = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3000,
      path: '/api/no-fly',
      headers: { 'Content-Type': 'application/json' }
    }, {
      route_id: routeId2,
      start_time: new Date(Date.now() + 86400000 * 3).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 6).toISOString(),
      applicant_id: applicantId,
      reason: '冲突测试-记录2',
      cancel_older_tasks: true
    });
    console.log('2. 创建时间冲突记录:', conflictCreate2.data.errors ? '✅ 检测到冲突' : '❌ 未检测到冲突');
    if (conflictCreate2.data.conflicts) {
      console.log(`   冲突详情: ${conflictCreate2.data.conflicts.length} 条记录冲突\n`);
    }

    console.log('='.repeat(60));
    console.log('❌ 测试场景 3: 导入坏行校验');
    console.log('='.repeat(60));

    const importRows = [
      {
        route_code: 'ROUTE-A-001',
        drone_code: 'DRONE-M300-001',
        applicant_name: '张三',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
        reason: '合法数据，应该通过'
      },
      {
        route_code: 'INVALID-ROUTE',
        applicant_name: '张三',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
        reason: '航线不存在'
      },
      {
        route_code: 'ROUTE-A-001',
        applicant_name: '不存在的人',
        start_time: new Date().toISOString(),
        end_time: '无效日期',
        reason: 'bad'
      }
    ];

    const importResult = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3000,
      path: '/api/no-fly/import',
      headers: { 'Content-Type': 'application/json' }
    }, { rows: importRows });

    console.log('1. 批量导入校验:', importResult.status === 200 ? '✅ 完成' : '❌ 失败');
    console.log(`   总数: ${importResult.data.total}, 有效: ${importResult.data.valid}, 无效: ${importResult.data.invalid}`);
    
    const badRow = importResult.data.validationResults.find(r => !r.isValid);
    if (badRow) {
      console.log(`   坏行错误信息: ${badRow.errors.join(', ')}\n`);
    }

    console.log('='.repeat(60));
    console.log('📋 测试场景 4: 列表、详情、互相对齐');
    console.log('='.repeat(60));

    const listResult = await request({
      method: 'GET',
      hostname: 'localhost',
      port: 3000,
      path: '/api/no-fly?status=approved',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('1. 筛选状态列表:', listResult.status === 200 ? '✅ 通过' : '❌ 失败');
    console.log(`   已禁飞记录数: ${listResult.data.data.length}`);

    const firstRecord = listResult.data.data[0];
    if (firstRecord) {
      const verifyDetail = await request({
        method: 'GET',
        hostname: 'localhost',
        port: 3000,
        path: `/api/no-fly/${firstRecord.id}`,
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('2. 列表与详情对齐:', 
        verifyDetail.data.data.route_code === firstRecord.route_code ? '✅ 通过' : '❌ 不一致');
    }

    const exportResult = await request({
      method: 'GET',
      hostname: 'localhost',
      port: 3000,
      path: '/api/no-fly/export',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('3. 导出CSV:', exportResult.status === 200 ? '✅ 通过' : '❌ 失败');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 所有验收测试完成！');
    console.log('='.repeat(60));
    process.exit(0);

  } catch (error) {
    console.error('❌ 测试运行失败:', error.message);
    console.log('\n💡 请确保服务已启动: npm start');
    process.exit(1);
  }
}

setTimeout(runTests, 1500);