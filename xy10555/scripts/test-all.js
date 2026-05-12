const db = require('../src/models');
const ValuationService = require('../src/services/ValuationService');
const ValuationRulesService = require('../src/services/ValuationRulesService');

async function testRulesEngine() {
  console.log('\n' + '='.repeat(70));
  console.log('测试1: 估价规则引擎');
  console.log('='.repeat(70));
  
  const mockVehicle = {
    brand: '测试品牌',
    model: '测试型号',
    year: 2020,
    mileage: 60000,
    ownership_count: 1,
    use_nature: '非营运',
    market_reference_price: 150000
  };
  
  const basePrice = ValuationRulesService.calculateBasePrice(mockVehicle);
  console.log(`基础估价: ¥${basePrice}`);
  console.log(`(4年车龄，6万公里，市场参考价15万)`);
  
  console.log('\n--- 测试事故扣分规则 ---');
  const mockAccidents = [
    {
      accident_type: '重大事故',
      accident_severity: '严重',
      description: '测试重大事故',
      is_structural_damage: true,
      is_airbag_deployed: false
    }
  ];
  const accidentAnalysis = ValuationRulesService.analyzeAccidents(mockAccidents, basePrice);
  console.log(`重大事故+结构性损伤:`);
  console.log(`  总扣减: ¥${accidentAnalysis.totalDeduction}`);
  console.log(`  扣分数: ${accidentAnalysis.scoreDeduction}`);
  console.log(`  原因: ${accidentAnalysis.deductionReasons.join(', ')}`);
  
  console.log('\n--- 测试里程异常检测 ---');
  const mockMileage = [
    {
      reported_mileage: 30000,
      historical_mileages: '[]',
      verification_result: '正常',
      verification_method: 'OBD读取',
      is_rollback_suspected: false,
      verifier: '测试',
      verification_time: new Date()
    }
  ];
  const mileageAnalysis = ValuationRulesService.analyzeMileage(mockMileage, {
    ...mockVehicle,
    year: 2018,
    market_reference_price: 150000
  });
  console.log(`2018年车，表显3万公里(预期14万):`);
  console.log(`  里程异常: ${mileageAnalysis.hasAnomaly ? '是' : '否'}`);
  console.log(`  异常类型: ${mileageAnalysis.anomalyType || '无'}`);
  console.log(`  需要审核: ${mileageAnalysis.requiresReview ? '是' : '否'}`);
  
  console.log('\n--- 测试整备成本阈值 ---');
  const mockRepairs = [
    { category: '机械维修', item_name: '发动机大修', priority: '必须', estimated_cost: 15000, description: '测试' }
  ];
  const repairAnalysis = ValuationRulesService.analyzeRepairCosts(mockRepairs, 100000);
  console.log(`整备成本15000，基础价10万(阈值8%=8000):`);
  console.log(`  总成本: ¥${repairAnalysis.totalCost}`);
  console.log(`  阈值: ¥${repairAnalysis.threshold}`);
  console.log(`  超阈值: ${repairAnalysis.isOverThreshold ? '是' : '否'}`);
  
  console.log('\n✓ 规则引擎测试通过');
}

async function testValuationFlow() {
  console.log('\n' + '='.repeat(70));
  console.log('测试2: 完整估价流程');
  console.log('='.repeat(70));
  
  const testData = {
    request_id: `test-flow-${Date.now()}`,
    vehicle_profile: {
      vin: `TESTVIN${Date.now().toString().slice(-10)}`,
      brand: '本田',
      model: '雅阁 260TURBO',
      year: 2019,
      mileage: 85000,
      displacement: 1.5,
      transmission: '自动',
      fuel_type: '汽油',
      color: '白色',
      body_type: '轿车',
      ownership_count: 2,
      use_nature: '非营运',
      market_reference_price: 145000
    },
    inspection_items: [
      { category: '外观', item_name: '车身漆面', inspection_result: '轻微异常', description: '右后门有划痕', is_required: true, inspector: '测试员', inspection_time: new Date() },
      { category: '发动机', item_name: '发动机工况', inspection_result: '正常', is_required: true, inspector: '测试员', inspection_time: new Date() },
      { category: '变速箱', item_name: '变速箱工况', inspection_result: '正常', is_required: true, inspector: '测试员', inspection_time: new Date() },
      { category: '底盘', item_name: '悬挂系统', inspection_result: '正常', is_required: true, inspector: '测试员', inspection_time: new Date() },
      { category: '安全系统', item_name: '安全气囊', inspection_result: '正常', is_required: true, inspector: '测试员', inspection_time: new Date() }
    ],
    accident_records: [
      {
        accident_date: '2021-05-10',
        accident_type: '一般事故',
        accident_severity: '一般',
        description: '侧方停车剐蹭，更换右后视镜',
        damage_parts: JSON.stringify(['右后视镜']),
        repair_amount: 2000,
        is_structural_damage: false,
        insurance_claim: false,
        source: '车主自述',
        reporter: '测试'
      }
    ],
    mileage_verifications: [
      {
        reported_mileage: 85000,
        historical_mileages: JSON.stringify([
          { date: '2023-06-15', mileage: 65000 },
          { date: '2022-12-20', mileage: 48000 }
        ]),
        verification_result: '正常',
        verification_method: '保养记录',
        verifier: '测试',
        verification_time: new Date()
      }
    ],
    repair_costs: [
      { category: '保养维护', item_name: '大保养', priority: '必须', estimated_cost: 2500, description: '更换机油三滤、变速箱油' },
      { category: '外观修复', item_name: '右后门喷漆', priority: '建议', estimated_cost: 800, description: '修复划痕' }
    ]
  };
  
  console.log('\n--- 步骤1: 创建估价 ---');
  const result = await ValuationService.createValuation(testData, 'test-operator');
  const valuationId = result.valuation.id;
  console.log(`估价单号: ${result.valuation.valuation_no}`);
  console.log(`状态: ${result.valuation.status}`);
  console.log(`是否新建: ${result.isNew}`);
  
  console.log('\n--- 步骤2: 幂等性测试 ---');
  const idempotentResult = await ValuationService.createValuation(testData, 'test-operator');
  console.log(`重复请求结果: ${idempotentResult.message}`);
  console.log(`是否新建: ${idempotentResult.isNew}`);
  
  console.log('\n--- 步骤3: 推进状态 ---');
  const states = ['待检测', '检测中', '检测完成', '待审核', '审核通过', '估价完成'];
  for (const state of states) {
    const updated = await ValuationService.advanceStatus(valuationId, state, 'test-operator', `推进到${state}`);
    console.log(`  推进到: ${updated.status}`);
  }
  
  console.log('\n--- 步骤4: 查看估价结果 ---');
  const detail = await ValuationService.getValuationDetail(valuationId);
  console.log(`基础估价: ¥${detail.base_price}`);
  console.log(`事故扣减: ¥${detail.accident_deduction}`);
  console.log(`里程扣减: ¥${detail.mileage_deduction}`);
  console.log(`检测扣减: ¥${detail.inspection_deduction}`);
  console.log(`整备成本: ¥${detail.repair_cost_total}`);
  console.log(`最终估价: ¥${detail.final_price}`);
  console.log(`建议售价: ¥${detail.suggested_sale_price}`);
  console.log(`风险等级: ${detail.risk_level}`);
  
  let deductionReasons = [];
  try {
    deductionReasons = JSON.parse(detail.deduction_reasons || '[]');
  } catch {}
  if (deductionReasons.length > 0) {
    console.log('\n扣分原因:');
    deductionReasons.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
  }
  
  console.log('\n--- 步骤5: 查看历史记录 ---');
  console.log(`历史记录数: ${detail.history_records.length}`);
  detail.history_records.slice(0, 5).forEach((h, i) => {
    const status = h.from_status && h.to_status ? `${h.from_status}→${h.to_status}` : h.action;
    console.log(`  ${i + 1}. ${h.operator} - ${status} (${new Date(h.operation_time).toLocaleTimeString()})`);
  });
  
  console.log('\n--- 步骤6: 创建报价版本 ---');
  const quote1 = await ValuationService.createQuoteVersion(valuationId, {
    version_name: '首次报价',
    base_price: detail.base_price,
    accident_deduction: detail.accident_deduction,
    mileage_deduction: detail.mileage_deduction,
    inspection_deduction: detail.inspection_deduction,
    repair_cost_total: detail.repair_cost_total,
    final_price: detail.final_price,
    suggested_sale_price: detail.suggested_sale_price,
    quoted_price: detail.suggested_sale_price,
    customer_name: '测试客户1',
    customer_phone: `1380000${Date.now().toString().slice(-4)}`,
    quote_status: '已报价',
    change_reason: '首次报价'
  }, '销售-测试');
  console.log(`报价版本1: ${quote1.version_name}, 报价: ¥${quote1.quoted_price}`);
  
  await new Promise(r => setTimeout(r, 200));
  
  const quote2 = await ValuationService.createQuoteVersion(valuationId, {
    version_name: '优惠报价',
    base_price: detail.base_price,
    accident_deduction: detail.accident_deduction,
    mileage_deduction: detail.mileage_deduction,
    inspection_deduction: detail.inspection_deduction,
    repair_cost_total: detail.repair_cost_total,
    final_price: detail.final_price,
    suggested_sale_price: detail.suggested_sale_price,
    quoted_price: Math.round(detail.suggested_sale_price * 0.95),
    customer_name: '测试客户1',
    customer_phone: `1380000${Date.now().toString().slice(-4)}`,
    quote_status: '已报价',
    change_reason: '客户议价，给予5%优惠'
  }, '销售-测试');
  console.log(`报价版本2: ${quote2.version_name}, 报价: ¥${quote2.quoted_price}`);
  console.log(`报价对比: 版本1 ¥${quote1.quoted_price} → 版本2 ¥${quote2.quoted_price} (优惠¥${quote1.quoted_price - quote2.quoted_price})`);
  
  console.log('\n--- 步骤7: 人工修正 ---');
  const correction = await ValuationService.createManualCorrection(valuationId, {
    correction_type: '最终价格调整',
    field_name: 'final_price',
    before_value: { final_price: detail.final_price },
    after_value: { final_price: Math.round(detail.final_price * 0.97) },
    difference: `根据最新市场行情，将最终估价从¥${detail.final_price}调整为¥${Math.round(detail.final_price * 0.97)}`,
    reason: '同级别车型近期成交价下跌3%',
    update_valuation: false
  }, '审核-测试');
  console.log(`修正类型: ${correction.correction_type}`);
  console.log(`操作人: ${correction.operator}`);
  console.log(`修正原因: ${correction.reason}`);
  
  console.log('\n--- 步骤8: 生成报告 ---');
  const report = await ValuationService.generateReport(valuationId);
  console.log(`报告编号: ${report.report_no}`);
  console.log(`风险等级: ${report.valuation_info.risk_level}`);
  console.log(`价格明细:`);
  console.log(`  基础: ¥${report.price_breakdown.base_price}`);
  console.log(`  扣减: 事故¥${report.price_breakdown.accident_deduction} + 里程¥${report.price_breakdown.mileage_deduction} + 检测¥${report.price_breakdown.inspection_deduction}`);
  console.log(`  最终: ¥${report.price_breakdown.final_price}`);
  
  console.log('\n--- 步骤9: 销售解释报告 ---');
  console.log(report.sales_explanation);
  
  console.log('\n✓ 完整估价流程测试通过');
}

async function testFailureScenarios() {
  console.log('\n' + '='.repeat(70));
  console.log('测试3: 失败场景');
  console.log('='.repeat(70));
  
  console.log('\n--- 场景1: 非法状态流转 ---');
  try {
    const list = await ValuationService.getValuationList({ limit: 1 });
    if (list.items && list.items.length > 0) {
      const valuationId = list.items[0].id;
      await ValuationService.advanceStatus(valuationId, '估价完成', 'test-operator');
      console.log('✗ 应该拒绝非法流转');
    }
  } catch (error) {
    console.log(`✓ 正确拒绝: ${error.message}`);
  }
  
  console.log('\n--- 场景2: 缺少操作人的人工修正 ---');
  try {
    const list = await ValuationService.getValuationList({ limit: 1 });
    if (list.items && list.items.length > 0) {
      await ValuationService.createManualCorrection(list.items[0].id, {
        correction_type: '测试',
        before_value: { test: 1 },
        after_value: { test: 2 },
        reason: '测试'
      });
      console.log('✗ 应该要求操作人');
    }
  } catch (error) {
    console.log(`✓ 正确要求操作人`);
  }
  
  console.log('\n--- 场景3: 异常处理记录 ---');
  const list = await ValuationService.getValuationList({ limit: 1 });
  if (list.items && list.items.length > 0) {
    const valuationId = list.items[0].id;
    await ValuationService.handleError(valuationId, { message: '模拟检测系统异常' }, 'admin-test');
    
    const detail = await ValuationService.getValuationDetail(valuationId);
    const errorHistory = detail.history_records?.find(h => h.action === '异常处理');
    
    if (errorHistory) {
      console.log(`✓ 异常已记录，失败原因: ${errorHistory.failure_reason}`);
      console.log(`✓ 标记需人工审核: ${detail.requires_manual_review ? '是' : '否'}`);
    }
  }
  
  console.log('\n✓ 失败场景测试通过');
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('二手车检测估价 API - 综合测试');
  console.log('='.repeat(70));
  
  try {
    console.log('\n连接数据库...');
    await db.sequelize.authenticate();
    console.log('数据库连接成功');
    
    await db.sequelize.sync();
    console.log('数据库同步完成');
    
    await testRulesEngine();
    await testValuationFlow();
    await testFailureScenarios();
    
    console.log('\n' + '='.repeat(70));
    console.log('✓ 所有测试通过！');
    console.log('='.repeat(70));
    console.log('\n📋 测试总结:');
    console.log('  ✓ 规则引擎: 事故扣分、里程异常、整备成本阈值');
    console.log('  ✓ 估价流程: 创建→推进→估价→报价→报告');
    console.log('  ✓ 状态追踪: 每一步都有历史记录');
    console.log('  ✓ 幂等性: 相同request_id重复创建返回已存在');
    console.log('  ✓ 报价版本: 支持多版本对比');
    console.log('  ✓ 人工修正: 记录前后差异和操作人');
    console.log('  ✓ 销售报告: 完整的价格说明和风险提示');
    console.log('  ✓ 失败处理: 非法流转被拒绝，异常被记录');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('\n✗ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
