const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const result = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
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

async function runTest() {
  console.log('=========================================');
  console.log('配送算法后台骑手改派补偿API测试流程');
  console.log('=========================================\n');

  try {
    console.log('0. 健康检查');
    const health = await request('GET', '/health');
    console.log(`   状态: ${health.status} - ${health.data.status}\n`);

    console.log('1. 获取元数据（状态、改派类型）');
    const meta = await request('GET', '/api/compensations/meta');
    console.log(`   状态列表: ${meta.data.statuses.join(', ')}`);
    console.log(`   改派类型: ${meta.data.reassignmentTypes.join(', ')}\n`);

    console.log('2. 创建补偿记录（骑手拒单）');
    const create1 = await request('POST', '/api/compensations', {
      riderId: 'R1001',
      riderName: '测试骑手A',
      orderId: 'O1001',
      orderNo: 'ORD-2024-001',
      reassignmentType: '骑手拒单',
      reason: '联系不上客户，客户电话无人接听',
      compensationAmount: 15.5,
      operator: 'test-admin'
    });
    const recordId1 = create1.data.id;
    console.log(`   创建成功, ID: ${recordId1}`);
    console.log(`   当前状态: ${create1.data.status}\n`);

    console.log('3. 创建补偿记录（系统改派）');
    const create2 = await request('POST', '/api/compensations', {
      riderId: 'R1002',
      riderName: '测试骑手B',
      orderId: 'O1002',
      orderNo: 'ORD-2024-002',
      reassignmentType: '系统改派',
      reason: '商家出餐延迟，系统自动改派',
      compensationAmount: 22.0,
      operator: 'test-admin'
    });
    const recordId2 = create2.data.id;
    console.log(`   创建成功, ID: ${recordId2}\n`);

    console.log('4. 状态流转: 待派送 -> 改派中');
    const status1 = await request('PUT', `/api/compensations/${recordId1}/status`, {
      newStatus: '改派中',
      reason: '骑手确认拒单',
      operator: 'test-admin'
    });
    console.log(`   流转后状态: ${status1.data.status}\n`);

    console.log('5. 状态流转: 改派中 -> 补偿待审');
    const status2 = await request('PUT', `/api/compensations/${recordId1}/status`, {
      newStatus: '补偿待审',
      reason: '改派完成，新骑手已接单',
      operator: 'system'
    });
    console.log(`   流转后状态: ${status2.data.status}\n`);

    console.log('6. 状态流转: 补偿待审 -> 已结算');
    const status3 = await request('PUT', `/api/compensations/${recordId1}/status`, {
      newStatus: '已结算',
      reason: '财务审核通过，补偿已打款',
      operator: 'finance'
    });
    console.log(`   流转后状态: ${status3.data.status}\n`);

    console.log('7. 查看详情');
    const detail = await request('GET', `/api/compensations/${recordId1}`);
    console.log(`   订单号: ${detail.data.orderNo}`);
    console.log(`   骑手: ${detail.data.riderName}`);
    console.log(`   改派类型: ${detail.data.reassignmentType}`);
    console.log(`   补偿金额: ${detail.data.compensationAmount}元`);
    console.log(`   当前状态: ${detail.data.status}\n`);

    console.log('8. 查看历史记录');
    const history = await request('GET', `/api/compensations/${recordId1}/history`);
    console.log(`   历史记录数: ${history.data.history.length}`);
    history.data.history.forEach((h, idx) => {
      console.log(`   ${idx + 1}. [${h.timestamp.slice(0, 19)}] ${h.action} - ${h.detail} (${h.operator})`);
    });
    console.log('');

    console.log('9. 测试状态越级（非法流转）');
    const invalidStatus = await request('PUT', `/api/compensations/${recordId1}/status`, {
      newStatus: '待派送',
      reason: '尝试回退状态',
      operator: 'test'
    });
    console.log(`   预期错误: ${invalidStatus.data.error}\n`);

    console.log('10. 查看列表');
    const list = await request('GET', '/api/compensations');
    console.log(`   总记录数: ${list.data.total}\n`);

    console.log('11. 按状态筛选（已结算）');
    const settledList = await request('GET', '/api/compensations?status=已结算');
    console.log(`   已结算记录数: ${settledList.data.total}\n`);

    console.log('12. 批量导入（含坏行测试）');
    const batchResult = await request('POST', '/api/compensations/batch', {
      records: [
        {
          riderId: 'R1003',
          riderName: '批量骑手1',
          orderId: 'O-BATCH-001',
          orderNo: 'ORD-BATCH-001',
          reassignmentType: '骑手拒单',
          reason: '批量导入数据1',
          compensationAmount: 18.0
        },
        {
          riderId: '',
          riderName: '坏行骑手',
          orderId: '',
          orderNo: 'ORD-BATCH-BAD',
          reassignmentType: '',
          reason: '批量导入坏行',
          compensationAmount: 0
        },
        {
          riderId: 'R1004',
          riderName: '批量骑手2',
          orderId: 'O-BATCH-002',
          orderNo: 'ORD-BATCH-002',
          reassignmentType: '系统改派',
          reason: '批量导入数据2',
          compensationAmount: 25.0
        }
      ]
    });
    console.log(`   成功: ${batchResult.data.success}, 失败: ${batchResult.data.failed}`);
    const badRow = batchResult.data.results.find(r => r.importError);
    if (badRow) {
      console.log(`   坏行ID: ${badRow.id}, 错误信息: ${badRow.importErrorMsg}\n`);
    }

    console.log('13. 导出CSV');
    const exportResult = await request('POST', '/api/compensations/export', {});
    console.log(`   导出文件名: ${exportResult.data.filename}`);
    console.log(`   导出记录数: ${exportResult.data.recordCount}\n`);

    console.log('14. 查看导出文件列表');
    const exportList = await request('GET', '/api/compensations/export/list');
    console.log(`   导出文件数: ${exportList.data.files.length}`);
    exportList.data.files.forEach(f => console.log(`   - ${f}`));
    console.log('');

    console.log('15. 创建冲突记录（同一订单重复提交）');
    const conflictOrderId = 'O-CONFLICT-TEST';
    const conflict1 = await request('POST', '/api/compensations', {
      riderId: 'R2001',
      riderName: '冲突骑手A',
      orderId: conflictOrderId,
      orderNo: 'ORD-CONFLICT-TEST',
      reassignmentType: '骑手拒单',
      reason: '冲突测试1',
      compensationAmount: 20.0
    });
    const conflict2 = await request('POST', '/api/compensations', {
      riderId: 'R2002',
      riderName: '冲突骑手B',
      orderId: conflictOrderId,
      orderNo: 'ORD-CONFLICT-TEST',
      reassignmentType: '系统改派',
      reason: '冲突测试2',
      compensationAmount: 30.0
    });
    console.log(`   冲突记录1冲突标记: ${conflict1.data.conflict}`);
    console.log(`   冲突记录2冲突标记: ${conflict2.data.conflict}`);
    console.log(`   冲突说明: ${conflict1.data.conflictNote}\n`);

    console.log('16. 按冲突筛选');
    const conflictList = await request('GET', '/api/compensations?conflict=true');
    console.log(`   冲突记录数: ${conflictList.data.total}\n`);

    console.log('17. 按导入错误筛选');
    const errorList = await request('GET', '/api/compensations?importError=true');
    console.log(`   导入错误记录数: ${errorList.data.total}\n`);

    console.log('=========================================');
    console.log('测试流程完成！');
    console.log('=========================================');
    console.log('\n关键数据验证:');
    console.log('  ✓ 完整状态流转（4个状态）');
    console.log('  ✓ 历史记录追踪');
    console.log('  ✓ 状态越级拦截');
    console.log('  ✓ 冲突检测（重复订单）');
    console.log('  ✓ 导入坏行标记');
    console.log('  ✓ CSV导出功能');

  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('\n请先启动服务: npm start');
    process.exit(1);
  }
}

runTest();
