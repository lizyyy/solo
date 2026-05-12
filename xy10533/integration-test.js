const { initializeDatabase } = require('./src/database');
const traceabilityService = require('./src/services/traceabilityService');
const reportService = require('./src/services/reportService');

const runTests = async () => {
  console.log('========================================');
  console.log('餐饮预制菜追溯 API - 集成测试');
  console.log('========================================\n');

  let testResults = [];
  let allPassed = true;

  try {
    await initializeDatabase();
    console.log('✓ 数据库初始化成功\n');

    // ========== 测试 1: 创建门店 ==========
    console.log('【测试 1】创建门店');
    console.log('------------------------------------------------------------');
    try {
      const storeResult = await traceabilityService.createStore({
        store_name: '测试门店',
        store_code: 'INT_TEST_STORE_001',
        city: '北京',
        address: '北京市朝阳区测试地址'
      }, 'test_user');
      console.log('门店ID:', storeResult.id);
      console.log('门店名称:', storeResult.store_name);
      console.log('✓ 通过 - 门店创建成功');
      testResults.push({ test: '创建门店', passed: true });
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '创建门店', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试 2: 创建批次 ==========
    console.log('【测试 2】创建批次');
    console.log('------------------------------------------------------------');
    let batchId;
    try {
      const batchResult = await traceabilityService.createBatch({
        product_name: '集成测试预制菜',
        product_code: 'INT_TEST_PROD_001',
        production_date: '2026-05-10',
        expiry_date: '2026-08-10',
        quantity: 100,
        unit: '箱'
      }, 'test_user');
      batchId = batchResult.id;
      console.log('批次ID:', batchResult.id);
      console.log('初始状态:', batchResult.status);
      console.log('✓ 通过 - 批次创建成功');
      testResults.push({ test: '创建批次', passed: true });
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '创建批次', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试 3: 出库 ==========
    console.log('【测试 3】出库');
    console.log('------------------------------------------------------------');
    let outboundId;
    try {
      const outboundResult = await traceabilityService.createOutbound({
        batch_id: batchId,
        quantity: 50,
        outbound_time: '2026-05-12 08:00:00'
      }, 'test_user');
      outboundId = outboundResult.id;
      console.log('出库数量:', outboundResult.quantity);
      console.log('✓ 通过 - 出库成功');
      testResults.push({ test: '出库', passed: true });
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '出库', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试 4: 开始冷链运输 ==========
    console.log('【测试 4】开始冷链运输');
    console.log('------------------------------------------------------------');
    let coldChainId;
    let storeId;
    try {
      const stores = await traceabilityService.getStores();
      storeId = stores[0].id;
      
      const coldChainStartResult = await traceabilityService.startColdChain({
        batch_id: batchId,
        store_id: storeId,
        outbound_record_id: outboundId,
        transport_start_time: '2026-05-12 09:00:00'
      }, 'test_user');
      coldChainId = coldChainStartResult.id;
      console.log('冷链ID:', coldChainStartResult.id);
      console.log('状态:', coldChainStartResult.status);
      console.log('✓ 通过 - 冷链开始');
      testResults.push({ test: '开始冷链运输', passed: true });
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '开始冷链运输', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试 5: 完成冷链运输（正常温度） ==========
    console.log('【测试 5】完成冷链运输（正常温度）');
    console.log('------------------------------------------------------------');
    try {
      const coldChainCompleteResult = await traceabilityService.completeColdChain(coldChainId, {
        transport_end_time: '2026-05-12 11:30:00',
        temperature_log: [
          { time: '2026-05-12 09:00:00', temperature: -18 },
          { time: '2026-05-12 10:00:00', temperature: -17 },
          { time: '2026-05-12 11:30:00', temperature: -15 }
        ]
      }, 'test_user');
      console.log('状态:', coldChainCompleteResult.status);
      console.log('平均温度:', coldChainCompleteResult.avg_temperature);
      console.log('是否异常:', coldChainCompleteResult.is_abnormal);
      if (coldChainCompleteResult.status === 'COMPLETED' && 
          coldChainCompleteResult.is_abnormal === 0) {
        console.log('✓ 通过 - 冷链正常完成');
        testResults.push({ test: '完成冷链运输(正常)', passed: true });
      } else {
        console.log('✗ 失败 - 状态或异常标志不正确');
        testResults.push({ test: '完成冷链运输(正常)', passed: false, error: '状态不正确' });
        allPassed = false;
      }
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '完成冷链运输(正常)', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试 6: 门店接收 ==========
    console.log('【测试 6】门店接收');
    console.log('------------------------------------------------------------');
    try {
      const receiveResult = await traceabilityService.receiveBatch({
        cold_chain_record_id: coldChainId,
        receive_time: '2026-05-12 12:00:00',
        remarks: '集成测试接收'
      }, 'test_user');
      console.log('接收数量:', receiveResult.quantity);
      console.log('✓ 通过 - 接收成功');
      testResults.push({ test: '门店接收', passed: true });
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '门店接收', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试 7: 开始解冻 ==========
    console.log('【测试 7】开始解冻');
    console.log('------------------------------------------------------------');
    let thawId;
    try {
      const thawStartResult = await traceabilityService.startThaw({
        batch_id: batchId,
        store_id: storeId,
        quantity: 10,
        thaw_start_time: '2026-05-12 14:00:00',
        expected_thaw_time: '2026-05-12 20:00:00'
      }, 'test_user');
      thawId = thawStartResult.id;
      console.log('解冻数量:', thawStartResult.quantity);
      console.log('✓ 通过 - 解冻开始');
      testResults.push({ test: '开始解冻', passed: true });
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '开始解冻', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试 8: 完成解冻 ==========
    console.log('【测试 8】完成解冻');
    console.log('------------------------------------------------------------');
    try {
      const thawCompleteResult = await traceabilityService.completeThaw(thawId, {
        thaw_end_time: '2026-05-12 19:30:00'
      }, 'test_user');
      console.log('状态:', thawCompleteResult.status);
      console.log('是否超时:', thawCompleteResult.is_overtime);
      if (thawCompleteResult.status === 'COMPLETED' && 
          thawCompleteResult.is_overtime === 0) {
        console.log('✓ 通过 - 解冻正常完成');
        testResults.push({ test: '完成解冻', passed: true });
      } else {
        console.log('✗ 失败 - 状态或超时标志不正确');
        testResults.push({ test: '完成解冻', passed: false, error: '状态不正确' });
        allPassed = false;
      }
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '完成解冻', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试 9: 销售 ==========
    console.log('【测试 9】销售');
    console.log('------------------------------------------------------------');
    try {
      const saleResult = await traceabilityService.createSale({
        batch_id: batchId,
        store_id: storeId,
        quantity: 5,
        sale_time: '2026-05-12 21:00:00'
      }, 'test_user');
      console.log('销售数量:', saleResult.quantity);
      console.log('✓ 通过 - 销售成功');
      testResults.push({ test: '销售', passed: true });
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '销售', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试 10: 查询批次详情（含历史记录） ==========
    console.log('【测试 10】查询批次详情（含历史记录）');
    console.log('------------------------------------------------------------');
    try {
      const batchDetailResult = await traceabilityService.getBatchDetail(batchId);
      console.log('批次状态:', batchDetailResult.batch.status);
      console.log('历史记录数:', batchDetailResult.history.length);
      if (batchDetailResult.history.length > 0) {
        const lastHistory = batchDetailResult.history[batchDetailResult.history.length - 1];
        console.log('最近操作:', lastHistory.action);
        console.log('操作人:', lastHistory.operator);
      }
      console.log('✓ 通过 - 批次详情查询成功');
      testResults.push({ test: '批次详情查询', passed: true });
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '批次详情查询', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试 11: 库存查询 ==========
    console.log('【测试 11】库存查询');
    console.log('------------------------------------------------------------');
    try {
      const inventoryResult = await traceabilityService.getStoreInventory();
      if (inventoryResult.length > 0) {
        const inv = inventoryResult[0];
        console.log('门店:', inv.store_name);
        console.log('总库存:', inv.quantity);
        console.log('冷冻:', inv.frozen_quantity);
        console.log('解冻:', inv.thawed_quantity);
        console.log('已售:', inv.sold_quantity);
        console.log('✓ 通过 - 库存查询成功');
        testResults.push({ test: '库存查询', passed: true });
      } else {
        console.log('库存数据为空');
        testResults.push({ test: '库存查询', passed: false, error: '无数据' });
        allPassed = false;
      }
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '库存查询', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试 12: 批次流向报告 ==========
    console.log('【测试 12】生成批次流向报告');
    console.log('------------------------------------------------------------');
    try {
      const reportResult = await reportService.generateBatchFlowReport(batchId);
      console.log('报告类型:', reportResult.report_type);
      console.log('批次:', reportResult.batch_info.product_name);
      console.log('流向步骤数:', reportResult.flow_path.length);
      console.log('已售:', reportResult.statistics.total_sold, '箱');
      console.log('库存:', reportResult.statistics.total_in_stores, '箱');
      console.log('✓ 通过 - 批次流向报告生成成功');
      testResults.push({ test: '批次流向报告', passed: true });
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '批次流向报告', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试 13: 召回 ==========
    console.log('【测试 13】召回');
    console.log('------------------------------------------------------------');
    try {
      const recallResult = await traceabilityService.createRecall({
        batch_id: batchId,
        recall_reason: '集成测试召回原因',
        recall_time: '2026-05-12 22:00:00'
      }, 'test_user');
      console.log('召回原因:', recallResult.recall_reason);
      console.log('✓ 通过 - 召回成功');
      testResults.push({ test: '召回', passed: true });
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '召回', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试 14: 召回后禁止销售规则 ==========
    console.log('【测试 14】验证召回后禁止销售规则');
    console.log('------------------------------------------------------------');
    try {
      await traceabilityService.createSale({
        batch_id: batchId,
        store_id: storeId,
        quantity: 2,
        sale_time: '2026-05-12 22:30:00'
      }, 'test_user');
      console.log('✗ 失败 - 召回批次应该禁止销售');
      testResults.push({ test: '召回后禁止销售', passed: false, error: '规则未生效' });
      allPassed = false;
    } catch (error) {
      console.log('错误信息:', error.message);
      console.log('✓ 通过 - 规则生效，召回批次禁止销售');
      testResults.push({ test: '召回后禁止销售', passed: true });
    }
    console.log('');

    // ========== 测试 15: 幂等性 - 重复出库 ==========
    console.log('【测试 15】验证幂等性 - 重复出库');
    console.log('------------------------------------------------------------');
    try {
      const duplicateOutbound = await traceabilityService.createOutbound({
        batch_id: batchId,
        quantity: 50,
        outbound_time: '2026-05-12 08:00:00'
      }, 'test_user');
      console.log('出库ID是否相同:', duplicateOutbound.id === outboundId ? '是' : '否');
      if (duplicateOutbound.id === outboundId) {
        console.log('✓ 通过 - 幂等性生效，重复操作返回第一次结果');
        testResults.push({ test: '幂等性验证', passed: true });
      } else {
        console.log('✗ 失败 - 创建了新的出库记录');
        testResults.push({ test: '幂等性验证', passed: false, error: '创建了重复记录' });
        allPassed = false;
      }
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '幂等性验证', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试 16: 禁止重复接收 ==========
    console.log('【测试 16】验证禁止重复接收规则');
    console.log('------------------------------------------------------------');
    try {
      await traceabilityService.receiveBatch({
        cold_chain_record_id: coldChainId,
        receive_time: '2026-05-12 13:00:00',
        remarks: '第二次尝试接收'
      }, 'test_user');
      console.log('✗ 失败 - 应该禁止重复接收');
      testResults.push({ test: '禁止重复接收', passed: false, error: '规则未生效' });
      allPassed = false;
    } catch (error) {
      console.log('错误信息:', error.message);
      console.log('✓ 通过 - 规则生效，禁止重复接收');
      testResults.push({ test: '禁止重复接收', passed: true });
    }
    console.log('');

    // ========== 测试 17: 召回报告 ==========
    console.log('【测试 17】生成召回报告');
    console.log('------------------------------------------------------------');
    try {
      const recallReportResult = await reportService.generateRecallReport(batchId);
      console.log('召回原因:', recallReportResult.recall_info.recall_reason);
      console.log('总分发:', recallReportResult.recall_statistics.total_distributed, '箱');
      console.log('已售:', recallReportResult.recall_statistics.total_sold, '箱');
      console.log('门店剩余:', recallReportResult.recall_statistics.total_in_stores, '箱');
      console.log('覆盖率:', recallReportResult.recall_statistics.coverage_rate);
      console.log('✓ 通过 - 召回报告生成成功');
      testResults.push({ test: '召回报告', passed: true });
    } catch (error) {
      console.log('✗ 失败:', error.message);
      testResults.push({ test: '召回报告', passed: false, error: error.message });
      allPassed = false;
    }
    console.log('');

    // ========== 测试结果汇总 ==========
    console.log('========================================');
    console.log('测试结果汇总');
    console.log('========================================\n');
    
    testResults.forEach((result, index) => {
      const status = result.passed ? '✓' : '✗';
      console.log(`${status} 测试 ${index + 1}: ${result.test}`);
      if (!result.passed && result.error) {
        console.log(`   错误: ${result.error}`);
      }
    });

    const passed = testResults.filter(r => r.passed).length;
    const total = testResults.length;
    console.log(`\n通过: ${passed}/${total}`);
    
    if (allPassed) {
      console.log('\n✓✓✓ 所有测试通过！✓✓✓');
      process.exitCode = 0;
    } else {
      console.log(`\n✗ 有 ${total - passed} 个测试失败`);
      process.exitCode = 1;
    }

  } catch (testError) {
    console.error('测试执行错误:', testError);
    console.error(testError.stack);
    allPassed = false;
    process.exitCode = 1;
  }
};

runTests();
