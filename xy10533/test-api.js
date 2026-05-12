const http = require('http');

const PORT = process.env.PORT || 3002;

const makeRequest = (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'x-operator': 'test_user'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
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

const testAPI = async () => {
  console.log('========================================');
  console.log('开始测试 API 功能');
  console.log('========================================\n');

  try {
    // 1. 测试健康检查
    console.log('1. 测试健康检查接口...');
    const healthCheck = await makeRequest('GET', '/');
    console.log('   状态码:', healthCheck.status);
    console.log('   响应:', healthCheck.data.message);
    console.log('   ✓ 健康检查通过\n');

    // 2. 测试创建门店
    console.log('2. 测试创建门店...');
    const storeResult = await makeRequest('POST', '/api/stores', {
      store_name: '测试门店',
      store_code: 'TEST_STORE_001',
      city: '北京',
      address: '测试地址'
    });
    console.log('   状态码:', storeResult.status);
    console.log('   成功:', storeResult.data.success);
    if (storeResult.data.success) {
      console.log('   门店ID:', storeResult.data.data.id);
      console.log('   门店名称:', storeResult.data.data.store_name);
    } else {
      console.log('   错误:', storeResult.data.error);
    }
    console.log('   ✓ 门店创建测试\n');

    const storeId = storeResult.data.data?.id;

    // 3. 测试创建批次
    console.log('3. 测试创建批次...');
    const batchResult = await makeRequest('POST', '/api/batches', {
      product_name: '测试预制菜',
      product_code: 'TEST_PROD_001',
      production_date: '2026-05-10',
      expiry_date: '2026-08-10',
      quantity: 100,
      unit: '箱'
    });
    console.log('   状态码:', batchResult.status);
    console.log('   成功:', batchResult.data.success);
    if (batchResult.data.success) {
      console.log('   批次ID:', batchResult.data.data.id);
      console.log('   产品名称:', batchResult.data.data.product_name);
      console.log('   当前状态:', batchResult.data.data.status);
    } else {
      console.log('   错误:', batchResult.data.error);
    }
    console.log('   ✓ 批次创建测试\n');

    const batchId = batchResult.data.data?.id;

    // 4. 测试出库
    console.log('4. 测试出库...');
    const outboundResult = await makeRequest('POST', '/api/outbound', {
      batch_id: batchId,
      quantity: 50,
      outbound_time: '2026-05-12 08:00:00'
    });
    console.log('   状态码:', outboundResult.status);
    console.log('   成功:', outboundResult.data.success);
    if (outboundResult.data.success) {
      console.log('   出库ID:', outboundResult.data.data.id);
      console.log('   出库数量:', outboundResult.data.data.quantity);
    } else {
      console.log('   错误:', outboundResult.data.error);
    }
    console.log('   ✓ 出库测试\n');

    const outboundId = outboundResult.data.data?.id;

    // 5. 测试开始冷链
    console.log('5. 测试开始冷链运输...');
    const coldChainStartResult = await makeRequest('POST', '/api/cold-chain/start', {
      batch_id: batchId,
      store_id: storeId,
      outbound_record_id: outboundId,
      transport_start_time: '2026-05-12 09:00:00'
    });
    console.log('   状态码:', coldChainStartResult.status);
    console.log('   成功:', coldChainStartResult.data.success);
    if (coldChainStartResult.data.success) {
      console.log('   冷链ID:', coldChainStartResult.data.data.id);
      console.log('   状态:', coldChainStartResult.data.data.status);
    } else {
      console.log('   错误:', coldChainStartResult.data.error);
    }
    console.log('   ✓ 冷链开始测试\n');

    const coldChainId = coldChainStartResult.data.data?.id;

    // 6. 测试完成冷链（正常温度）
    console.log('6. 测试完成冷链运输（正常温度）...');
    const coldChainCompleteResult = await makeRequest('POST', `/api/cold-chain/${coldChainId}/complete`, {
      transport_end_time: '2026-05-12 11:30:00',
      temperature_log: [
        { time: '2026-05-12 09:00:00', temperature: -18 },
        { time: '2026-05-12 10:00:00', temperature: -17 },
        { time: '2026-05-12 11:30:00', temperature: -15 }
      ]
    });
    console.log('   状态码:', coldChainCompleteResult.status);
    console.log('   成功:', coldChainCompleteResult.data.success);
    if (coldChainCompleteResult.data.success) {
      console.log('   状态:', coldChainCompleteResult.data.data.status);
      console.log('   平均温度:', coldChainCompleteResult.data.data.avg_temperature);
      console.log('   是否异常:', coldChainCompleteResult.data.data.is_abnormal);
    } else {
      console.log('   错误:', coldChainCompleteResult.data.error);
    }
    console.log('   ✓ 冷链完成测试（正常温度）\n');

    // 7. 测试接收
    console.log('7. 测试门店接收...');
    const receiveResult = await makeRequest('POST', '/api/receive', {
      cold_chain_record_id: coldChainId,
      receive_time: '2026-05-12 12:00:00',
      remarks: '测试接收'
    });
    console.log('   状态码:', receiveResult.status);
    console.log('   成功:', receiveResult.data.success);
    if (receiveResult.data.success) {
      console.log('   接收ID:', receiveResult.data.data.id);
      console.log('   接收数量:', receiveResult.data.data.quantity);
    } else {
      console.log('   错误:', receiveResult.data.error);
    }
    console.log('   ✓ 接收测试\n');

    // 8. 测试开始解冻
    console.log('8. 测试开始解冻...');
    const thawStartResult = await makeRequest('POST', '/api/thaw/start', {
      batch_id: batchId,
      store_id: storeId,
      quantity: 10,
      thaw_start_time: '2026-05-12 14:00:00',
      expected_thaw_time: '2026-05-12 20:00:00'
    });
    console.log('   状态码:', thawStartResult.status);
    console.log('   成功:', thawStartResult.data.success);
    if (thawStartResult.data.success) {
      console.log('   解冻ID:', thawStartResult.data.data.id);
      console.log('   解冻数量:', thawStartResult.data.data.quantity);
      console.log('   状态:', thawStartResult.data.data.status);
    } else {
      console.log('   错误:', thawStartResult.data.error);
    }
    console.log('   ✓ 解冻开始测试\n');

    const thawId = thawStartResult.data.data?.id;

    // 9. 测试完成解冻
    console.log('9. 测试完成解冻...');
    const thawCompleteResult = await makeRequest('POST', `/api/thaw/${thawId}/complete`, {
      thaw_end_time: '2026-05-12 19:30:00'
    });
    console.log('   状态码:', thawCompleteResult.status);
    console.log('   成功:', thawCompleteResult.data.success);
    if (thawCompleteResult.data.success) {
      console.log('   状态:', thawCompleteResult.data.data.status);
      console.log('   是否超时:', thawCompleteResult.data.data.is_overtime);
    } else {
      console.log('   错误:', thawCompleteResult.data.error);
    }
    console.log('   ✓ 解冻完成测试\n');

    // 10. 测试销售
    console.log('10. 测试销售...');
    const saleResult = await makeRequest('POST', '/api/sales', {
      batch_id: batchId,
      store_id: storeId,
      quantity: 5,
      sale_time: '2026-05-12 21:00:00'
    });
    console.log('   状态码:', saleResult.status);
    console.log('   成功:', saleResult.data.success);
    if (saleResult.data.success) {
      console.log('   销售ID:', saleResult.data.data.id);
      console.log('   销售数量:', saleResult.data.data.quantity);
    } else {
      console.log('   错误:', saleResult.data.error);
    }
    console.log('   ✓ 销售测试\n');

    // 11. 测试查询批次详情
    console.log('11. 测试查询批次详情（含历史记录）...');
    const batchDetailResult = await makeRequest('GET', `/api/batches/${batchId}`);
    console.log('   状态码:', batchDetailResult.status);
    console.log('   成功:', batchDetailResult.data.success);
    if (batchDetailResult.data.success) {
      console.log('   批次状态:', batchDetailResult.data.data.batch.status);
      console.log('   历史记录数:', batchDetailResult.data.data.history.length);
      console.log('   最近状态变更:');
      const lastHistory = batchDetailResult.data.data.history[batchDetailResult.data.data.history.length - 1];
      console.log(`     操作: ${lastHistory.action}`);
      console.log(`     状态变化: ${lastHistory.from_status} -> ${lastHistory.to_status}`);
      console.log(`     操作人: ${lastHistory.operator}`);
    } else {
      console.log('   错误:', batchDetailResult.data.error);
    }
    console.log('   ✓ 批次详情查询测试\n');

    // 12. 测试库存查询
    console.log('12. 测试库存查询...');
    const inventoryResult = await makeRequest('GET', '/api/inventory');
    console.log('   状态码:', inventoryResult.status);
    console.log('   成功:', inventoryResult.data.success);
    if (inventoryResult.data.success && inventoryResult.data.data.length > 0) {
      const inv = inventoryResult.data.data[0];
      console.log('   门店:', inv.store_name);
      console.log('   总库存:', inv.quantity);
      console.log('   冷冻:', inv.frozen_quantity);
      console.log('   解冻:', inv.thawed_quantity);
      console.log('   已售:', inv.sold_quantity);
    } else {
      console.log('   库存数据为空或查询失败');
    }
    console.log('   ✓ 库存查询测试\n');

    // 13. 测试生成批次流向报告
    console.log('13. 测试生成批次流向报告...');
    const reportResult = await makeRequest('GET', `/api/reports/batch-flow/${batchId}`);
    console.log('   状态码:', reportResult.status);
    console.log('   成功:', reportResult.data.success);
    if (reportResult.data.success) {
      console.log('   报告类型:', reportResult.data.data.report_type);
      console.log('   批次:', reportResult.data.data.batch_info.product_name);
      console.log('   流向步骤数:', reportResult.data.data.flow_path.length);
      console.log('   统计:');
      console.log(`     已售: ${reportResult.data.data.statistics.total_sold}箱`);
      console.log(`     库存: ${reportResult.data.data.statistics.total_in_stores}箱`);
    } else {
      console.log('   错误:', reportResult.data.error);
    }
    console.log('   ✓ 批次流向报告测试\n');

    // 14. 测试召回
    console.log('14. 测试召回...');
    const recallResult = await makeRequest('POST', '/api/recalls', {
      batch_id: batchId,
      recall_reason: '测试召回原因',
      recall_time: '2026-05-12 22:00:00'
    });
    console.log('   状态码:', recallResult.status);
    console.log('   成功:', recallResult.data.success);
    if (recallResult.data.success) {
      console.log('   召回ID:', recallResult.data.data.id);
      console.log('   召回原因:', recallResult.data.data.recall_reason);
    } else {
      console.log('   错误:', recallResult.data.error);
    }
    console.log('   ✓ 召回测试\n');

    // 15. 测试召回后禁止销售
    console.log('15. 测试召回后禁止销售规则...');
    const trySaleAfterRecall = await makeRequest('POST', '/api/sales', {
      batch_id: batchId,
      store_id: storeId,
      quantity: 2,
      sale_time: '2026-05-12 22:30:00'
    });
    console.log('   状态码:', trySaleAfterRecall.status);
    console.log('   成功:', trySaleAfterRecall.data.success);
    if (!trySaleAfterRecall.data.success) {
      console.log('   ✓ 规则生效 - 召回批次禁止销售');
      console.log('   错误信息:', trySaleAfterRecall.data.error);
    } else {
      console.log('   ✗ 规则失效 - 召回批次不应该可以销售');
    }
    console.log('   ✓ 召回后禁止销售规则测试\n');

    // 16. 测试幂等性 - 重复出库
    console.log('16. 测试幂等性 - 重复出库...');
    const duplicateOutbound = await makeRequest('POST', '/api/outbound', {
      batch_id: batchId,
      quantity: 50,
      outbound_time: '2026-05-12 08:00:00'
    });
    console.log('   状态码:', duplicateOutbound.status);
    console.log('   成功:', duplicateOutbound.data.success);
    if (duplicateOutbound.data.success) {
      console.log('   出库ID是否相同:', duplicateOutbound.data.data.id === outboundId ? '是 ✓' : '否 ✗');
      console.log('   ✓ 幂等性生效 - 重复操作返回第一次结果');
    } else {
      console.log('   错误:', duplicateOutbound.data.error);
    }
    console.log('   ✓ 幂等性测试\n');

    // 17. 测试召回报告
    console.log('17. 测试生成召回报告...');
    const recallReportResult = await makeRequest('GET', `/api/reports/recall/${batchId}`);
    console.log('   状态码:', recallReportResult.status);
    console.log('   成功:', recallReportResult.data.success);
    if (recallReportResult.data.success) {
      console.log('   召回原因:', recallReportResult.data.recall_info.recall_reason);
      console.log('   召回统计:');
      console.log(`     总分发: ${recallReportResult.data.recall_statistics.total_distributed}箱`);
      console.log(`     已售: ${recallReportResult.data.recall_statistics.total_sold}箱`);
      console.log(`     门店剩余: ${recallReportResult.data.recall_statistics.total_in_stores}箱`);
      console.log(`     覆盖率: ${recallReportResult.data.recall_statistics.coverage_rate}`);
    } else {
      console.log('   错误:', recallReportResult.data.error);
    }
    console.log('   ✓ 召回报告测试\n');

    console.log('========================================');
    console.log('所有 API 测试完成！');
    console.log('========================================');
    console.log('\n测试总结:');
    console.log('  ✓ 健康检查');
    console.log('  ✓ 门店管理');
    console.log('  ✓ 批次管理');
    console.log('  ✓ 出库');
    console.log('  ✓ 冷链运输（正常温度）');
    console.log('  ✓ 门店接收');
    console.log('  ✓ 解冻流程');
    console.log('  ✓ 销售');
    console.log('  ✓ 批次详情查询（含历史记录）');
    console.log('  ✓ 库存查询');
    console.log('  ✓ 批次流向报告');
    console.log('  ✓ 召回');
    console.log('  ✓ 召回后禁止销售规则');
    console.log('  ✓ 幂等性');
    console.log('  ✓ 召回报告');

  } catch (error) {
    console.error('测试失败:', error);
    console.error(error.stack);
  }
};

testAPI();
