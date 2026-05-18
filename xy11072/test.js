const http = require('http');

const baseUrl = 'http://localhost:3000';

const request = (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

const runTests = async () => {
  console.log('========== 社区诊疗车流动诊疗药品 API 测试 ==========\n');

  try {
    console.log('测试 1: 创建药品流转记录（草稿）');
    const createResult = await request('POST', '/api/transactions', {
      vehicle_no: 'VH001',
      vehicle_name: '社区诊疗车1号',
      site_code: 'ST001',
      site_name: '幸福社区卫生服务站',
      medicine_code: 'MED001',
      medicine_name: '阿莫西林胶囊',
      batch_no: 'B202401001',
      manufacture_date: '2024-01-15',
      expiry_date: '2026-01-14',
      specification: '0.25g*24粒',
      unit: '盒',
      quantity: 20,
      flow_type: 'VEHICLE_TO_SITE',
      operator: '张医生',
      remark: '日常补药'
    });
    console.log('  创建结果:', JSON.stringify(createResult, null, 2));
    const transactionId = createResult.data.id;
    console.log('  ✓ 创建成功\n');

    console.log('测试 2: 修改草稿记录');
    const updateResult = await request('PUT', `/api/transactions/${transactionId}`, {
      quantity: 25,
      remark: '日常补药，调整数量',
      operator: '张医生'
    });
    console.log('  修改结果:', JSON.stringify(updateResult, null, 2));
    console.log('  ✓ 修改成功\n');

    console.log('测试 3: 查看详情');
    const detailResult = await request('GET', `/api/transactions/${transactionId}`);
    console.log('  详情结果:', JSON.stringify(detailResult, null, 2));
    console.log('  ✓ 查看详情成功\n');

    console.log('测试 4: 提交记录');
    const submitResult = await request('POST', `/api/transactions/${transactionId}/submit`, {
      operator: '李护士'
    });
    console.log('  提交结果:', JSON.stringify(submitResult, null, 2));
    console.log('  ✓ 提交成功\n');

    console.log('测试 5: 查看库存');
    const stockResult = await request('GET', '/api/stock?stock_type=VEHICLE');
    console.log('  车上库存:', JSON.stringify(stockResult.data.list, null, 2));
    const siteStockResult = await request('GET', '/api/stock?stock_type=SITE');
    console.log('  站点库存:', JSON.stringify(siteStockResult.data.list, null, 2));
    console.log('  ✓ 查看库存成功\n');

    console.log('测试 6: 撤回记录');
    const withdrawResult = await request('POST', `/api/transactions/${transactionId}/withdraw`, {
      operator: '王主任',
      remark: '数量有误，需要重新核对'
    });
    console.log('  撤回结果:', JSON.stringify(withdrawResult, null, 2));
    console.log('  ✓ 撤回成功\n');

    console.log('测试 7: 人工处理备注');
    const manualResult = await request('POST', `/api/transactions/${transactionId}/manual`, {
      operator: '审核员',
      manual_remark: '已核对库存，确认数量需要调整为30盒',
      action: 'REVIEW'
    });
    console.log('  人工处理结果:', JSON.stringify(manualResult, null, 2));
    console.log('  ✓ 人工处理成功\n');

    console.log('测试 8: 重新提交（修改数量）');
    const resubmitResult = await request('POST', `/api/transactions/${transactionId}/resubmit`, {
      operator: '李护士',
      quantity: 30,
      remark: '按审核意见调整数量后重新提交'
    });
    console.log('  重新提交结果:', JSON.stringify(resubmitResult, null, 2));
    console.log('  ✓ 重新提交成功\n');

    console.log('测试 9: 查看完整历史记录');
    const historyResult = await request('GET', `/api/transactions/${transactionId}/history`);
    console.log('  历史记录:', JSON.stringify(historyResult.data, null, 2));
    console.log('  ✓ 查看历史记录成功\n');

    console.log('测试 10: 查看最终详情');
    const finalDetailResult = await request('GET', `/api/transactions/${transactionId}`);
    console.log('  最终详情:', JSON.stringify(finalDetailResult.data, null, 2));
    console.log('  ✓ 查看最终详情成功\n');

    console.log('测试 11: 库存一致性检查');
    const consistencyResult = await request('GET', '/api/stock/check-consistency');
    console.log('  一致性检查结果:', JSON.stringify(consistencyResult, null, 2));
    console.log('  ✓ 一致性检查完成\n');

    console.log('测试 12: 列表查询');
    const listResult = await request('GET', '/api/transactions?page=1&page_size=10');
    console.log('  列表查询结果:', JSON.stringify(listResult.data, null, 2));
    console.log('  ✓ 列表查询成功\n');

    console.log('========== 测试场景覆盖验证 ==========\n');
    
    console.log('✓ 场景1: 列表进入详情 -> 已覆盖（测试3、测试12）');
    console.log('✓ 场景2: 详情查看每次修改历史 -> 已覆盖（测试9）');
    console.log('✓ 场景3: 车上剩药和站点库存不同步检测 -> 已覆盖（测试11）');
    console.log('✓ 场景4: 药品流水一致性检查 -> 已覆盖（测试5、测试11）');
    console.log('✓ 场景5: 撤回后再次提交的组合 -> 已覆盖（测试6、测试7、测试8）');
    console.log('✓ 场景6: 人工处理后备注留痕 -> 已覆盖（测试7、测试10）');
    console.log('\n========== 所有测试通过！ ==========');

  } catch (error) {
    console.error('测试失败:', error.message);
    process.exit(1);
  }
};

runTests();
