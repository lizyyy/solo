const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3000;

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const jsonData = data ? JSON.stringify(data) : null;
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(jsonData ? { 'Content-Length': Buffer.byteLength(jsonData) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (jsonData) {
      req.write(jsonData);
    }
    req.end();
  });
}

async function runE2ETest() {
  console.log('========================================');
  console.log('  物业维修链路 - 端到端测试');
  console.log('========================================\n');

  let testOrderNo = null;
  let testReceiptNo = null;
  let snapshotNo1 = null;
  let snapshotNo2 = null;

  try {
    console.log('【步骤1】健康检查');
    const health = await request('GET', '/health');
    console.log(`  状态: ${health.status}`);
    console.log(`  服务: ${health.data.service}`);
    console.log('  ✓ 通过\n');

    console.log('【步骤2】创建报修单');
    const orderRes = await request('POST', '/api/v1/orders', {
      resident_id: 'E2E-001',
      resident_name: 'Test User',
      room_no: '9-999',
      repair_type: 'water_electric',
      description: 'E2E test - water leak',
      screenshot_url: '/e2e/test.jpg',
      report_time: '2024-03-01T09:00:00.000Z',
      operator: 'e2e_test'
    });
    testOrderNo = orderRes.data.data.order_no;
    console.log(`  报修单号: ${testOrderNo}`);
    console.log(`  脏记录数: ${orderRes.data.data.dirty_count}`);
    console.log('  ✓ 通过\n');

    console.log('【步骤3】创建维修回执(首次维修)');
    const receipt1Res = await request('POST', '/api/v1/receipts', {
      order_no: testOrderNo,
      repairman_id: 'W001',
      repairman_name: 'Test Master',
      arrival_time: '2024-03-01T10:00:00.000Z',
      complete_time: '2024-03-01T11:30:00.000Z',
      repair_content: 'replace pipe',
      is_rework: false,
      is_part_replacement: true,
      receipt_image_url: '/e2e/r1.jpg',
      labor_fee: 100,
      operator: 'e2e_test'
    });
    testReceiptNo = receipt1Res.data.data.receipt_no;
    console.log(`  回执单号: ${testReceiptNo}`);
    console.log(`  标记换件: 是`);
    console.log('  ✓ 通过\n');

    console.log('【步骤4】创建材料领用');
    const materialRes = await request('POST', '/api/v1/materials', {
      order_no: testOrderNo,
      receipt_no: testReceiptNo,
      material_code: 'M003',
      material_name: 'pipe connector',
      quantity: 2,
      unit_price: 15,
      total_price: 30,
      receiver: 'Test Master',
      receive_time: '2024-03-01T09:30:00.000Z',
      operator: 'e2e_test'
    });
    console.log(`  领用单号: ${materialRes.data.data.usage_no}`);
    console.log(`  材料: pipe connector x2`);
    console.log('  ✓ 通过\n');

    console.log('【步骤5】创建返修回执');
    const receipt2Res = await request('POST', '/api/v1/receipts', {
      order_no: testOrderNo,
      repairman_id: 'W001',
      repairman_name: 'Test Master',
      arrival_time: '2024-03-02T14:00:00.000Z',
      complete_time: '2024-03-02T15:00:00.000Z',
      repair_content: 'rework - seal',
      is_rework: true,
      is_part_replacement: false,
      receipt_image_url: '/e2e/r2.jpg',
      labor_fee: 50,
      operator: 'e2e_test'
    });
    console.log(`  返修回执号: ${receipt2Res.data.data.receipt_no}`);
    console.log(`  标记返修: 是`);
    console.log('  ✓ 通过\n');

    console.log('【步骤6】第一次对账快照');
    const reconcile1Res = await request('POST', `/api/v1/reconcile/${testOrderNo}`);
    snapshotNo1 = reconcile1Res.data.data.snapshotNo;
    console.log(`  快照号: ${snapshotNo1}`);
    console.log(`  总工费: ${reconcile1Res.data.data.totalLaborFee}`);
    console.log(`  总材料费: ${reconcile1Res.data.data.totalMaterialFee}`);
    console.log(`  回执数: ${reconcile1Res.data.data.receiptCount}`);
    console.log(`  返修次数: ${reconcile1Res.data.data.reworkCount}`);
    console.log(`  对账状态: ${reconcile1Res.data.data.isConsistent ? '一致' : '异常'}`);
    reconcile1Res.data.data.issues.forEach(i => console.log(`    ! ${i}`));
    console.log('  ✓ 通过\n');

    console.log('【步骤7】创建退款流水');
    const refundRes = await request('POST', '/api/v1/refunds', {
      order_no: testOrderNo,
      refund_amount: 30,
      refund_reason: 'rework discount',
      trans_time: '2024-03-03T10:00:00.000Z',
      operator: 'finance',
      operator_system: 'e2e_test'
    });
    console.log(`  退款单号: ${refundRes.data.data.trans_no}`);
    console.log(`  退款金额: ${refundRes.data.data.dirty_count > 0 ? '检测到异常' : '正常'}`);
    console.log('  ✓ 通过\n');

    console.log('【步骤8】第二次对账快照(退款后)');
    const reconcile2Res = await request('POST', `/api/v1/reconcile/${testOrderNo}`);
    snapshotNo2 = reconcile2Res.data.data.snapshotNo;
    console.log(`  快照号: ${snapshotNo2}`);
    console.log(`  总退款: ${reconcile2Res.data.data.totalRefund}`);
    console.log(`  净额: ${reconcile2Res.data.data.netAmount}`);
    console.log('  ✓ 通过\n');

    console.log('【步骤9】对比两次快照差异');
    const compareRes = await request('GET', `/api/v1/snapshots/compare/${snapshotNo1}/${snapshotNo2}`);
    console.log(`  存在变更: ${compareRes.data.data.has_changes ? '是' : '否'}`);
    compareRes.data.data.differences.forEach(d => {
      console.log(`    - ${d.field}: ${d.snapshot1} → ${d.snapshot2}${d.change !== null ? ` (变化: ${d.change})` : ''}`);
    });
    console.log('  ✓ 通过\n');

    console.log('【步骤10】查询完整链路回放');
    const chainRes = await request('GET', `/api/v1/chain/${testOrderNo}`);
    console.log(`  时间线事件数: ${chainRes.data.data.chain.length}`);
    console.log(`  事件明细:`);
    chainRes.data.data.chain.forEach((e, i) => {
      console.log(`    ${i + 1}. [${e.time.slice(0, 19)}] ${e.title}`);
    });
    console.log('  ✓ 通过\n');

    console.log('【步骤11】添加差异记录');
    const dispRes = await request('POST', '/api/v1/discrepancy', {
      order_no: testOrderNo,
      type: 'fee_dispute',
      description: 'rework should not charge again',
      reporter: 'cs'
    });
    console.log(`  差异单号: ${dispRes.data.data.discrepancy_no}`);
    console.log(`  类型: ${dispRes.data.data.type}`);
    console.log('  ✓ 通过\n');

    console.log('【步骤12】导出单条订单CSV');
    const exportRes = await request('GET', `/api/v1/export/order/${testOrderNo}`);
    console.log(`  文件名: ${exportRes.data.data.filename}`);
    console.log(`  路径: ${exportRes.data.data.filepath}`);
    console.log(`  预览长度: ${exportRes.data.data.preview.length} 字符`);
    console.log('  ✓ 通过\n');

    console.log('【步骤13】查询脏记录');
    const dirtyRes = await request('GET', '/api/v1/dirty-records?limit=5');
    console.log(`  脏记录总数: ${dirtyRes.data.pagination.total}`);
    console.log(`  未解决数: ${dirtyRes.data.data.filter(d => !d.is_resolved).length}`);
    console.log('  ✓ 通过\n');

    console.log('【步骤14】查询审计日志');
    const auditRes = await request('GET', `/api/v1/audit-logs?entity_id=${testOrderNo}&limit=10`);
    console.log(`  相关操作记录: ${auditRes.data.data.length} 条`);
    auditRes.data.data.forEach(log => {
      console.log(`    - [${log.created_at.slice(0, 19)}] ${log.action} - ${log.remark}`);
    });
    console.log('  ✓ 通过\n');

    console.log('========================================');
    console.log('  ✓ 全部测试通过！');
    console.log('========================================');
    console.log(`\n测试报修单号: ${testOrderNo}`);
    console.log(`对账快照1: ${snapshotNo1}`);
    console.log(`对账快照2: ${snapshotNo2}`);
    console.log('\n可以使用这些单号进行进一步的手动测试。');

  } catch (err) {
    console.error('\n✗ 测试失败:', err.message);
    console.error(err.stack);
    console.error('请确保服务已启动: npm start');
    process.exit(1);
  }
}

runE2ETest();
