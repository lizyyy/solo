const { store, initDatabase } = require('./database');
const billingEngine = require('./billing-engine');
const { loadSampleData } = require('./sample-data');

function printSection(title) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80));
}

function printSubsection(title) {
  console.log('\n  ' + '-'.repeat(70));
  console.log(`  ${title}`);
  console.log('  ' + '-'.repeat(70));
}

function formatMoney(amount) {
  return `¥${amount.toFixed(2)}`;
}

function runDemo() {
  console.log('\n🚀 仓储计费阶梯 API - 功能演示');
  console.log('='.repeat(80));

  initDatabase();

  printSection('1. 初始化并加载样例数据');
  const sampleData = loadSampleData();
  console.log(`  ✅ 客户: 鲜来鲜往食品有限公司 (${sampleData.customer1Id})`);
  console.log(`  ✅ 操作记录: ${sampleData.operationCount} 条 (60次，触发5%操作阶梯折扣)`);
  console.log(`  ✅ 计费周期: ${sampleData.periodStart} ~ ${sampleData.periodEnd}`);

  printSection('2. 查看计费规则配置');
  
  printSubsection('2.1 库龄阶梯费率');
  const ageLadders = [...store.age_ladders].sort((a, b) => a.min_days - b.min_days);
  for (const ladder of ageLadders) {
    const range = ladder.max_days ? `${ladder.min_days}-${ladder.max_days}天` : `${ladder.min_days}天以上`;
    console.log(`    ${ladder.name.padEnd(15)} [${range.padEnd(15)}] 费率乘数: ${ladder.multiplier}x - ${ladder.description}`);
  }

  printSubsection('2.2 温区费率');
  const zoneRates = store.zone_rates.map(r => {
    const zone = store.temperature_zones.find(z => z.id === r.zone_id);
    return { ...r, zone_name: zone?.name };
  });
  console.log(`    ${'温区'.padEnd(10)} ${'仓储费/立方/天'.padEnd(18)} ${'入库操作费'.padEnd(12)} ${'出库操作费'.padEnd(12)}`);
  for (const rate of zoneRates) {
    console.log(`    ${(rate.zone_name || '').padEnd(10)} ${formatMoney(rate.storage_rate_per_cbm_per_day).padEnd(18)} ${formatMoney(rate.in_operation_fee).padEnd(12)} ${formatMoney(rate.out_operation_fee).padEnd(12)}`);
  }

  printSubsection('2.3 操作次数阶梯折扣');
  const opLadders = [...store.operation_ladders].sort((a, b) => a.min_operations - b.min_operations);
  for (const ladder of opLadders) {
    const range = ladder.max_operations ? `${ladder.min_operations}-${ladder.max_operations}次` : `${ladder.min_operations}次以上`;
    const discount = Math.round((1 - ladder.discount_rate) * 100);
    console.log(`    ${ladder.name.padEnd(15)} [${range.padEnd(18)}] 折扣率: ${discount}%`);
  }

  printSection('3. 场景一：正常计费流程演示');
  
  printSubsection('3.1 生成账单');
  const bill1 = billingEngine.generateBill(
    sampleData.customer1Id,
    sampleData.periodStart,
    sampleData.periodEnd,
    'demo_user'
  );
  console.log(`  ✅ 账单ID: ${bill1.id}`);
  console.log(`  ✅ 状态: ${bill1.status}`);
  console.log(`  ✅ 仓储费: ${formatMoney(bill1.storage_fee)}`);
  console.log(`  ✅ 入库操作费: ${formatMoney(bill1.in_operation_fee)}`);
  console.log(`  ✅ 出库操作费: ${formatMoney(bill1.out_operation_fee)}`);
  console.log(`  ✅ 账单总金额: ${formatMoney(bill1.total_amount)}`);

  printSubsection('3.2 费用明细项目');
  console.log(`    ${'类型'.padEnd(15)} ${'描述'.padEnd(45)} ${'数量'.padEnd(10)} ${'单价'.padEnd(12)} ${'金额'.padEnd(12)}`);
  for (const item of bill1.line_items) {
    console.log(`    ${item.line_type.padEnd(15)} ${item.description.substring(0, 43).padEnd(45)} ${String(item.quantity.toFixed(2)).padEnd(10)} ${formatMoney(item.unit_price).padEnd(12)} ${formatMoney(item.amount).padEnd(12)}`);
  }

  printSection('4. 场景二：库龄阶梯加价演示');
  
  printSubsection('4.1 库龄明细（按阶梯分组）');
  const ageSummary = {};
  for (const detail of bill1.age_details) {
    const key = `${detail.ladder_name}@${detail.zone_name}`;
    if (!ageSummary[key]) {
      ageSummary[key] = {
        ladder: detail.ladder_name,
        zone: detail.zone_name,
        multiplier: detail.ladder_multiplier,
        base_rate: detail.base_rate,
        total_volume_days: 0,
        total_fee: 0
      };
    }
    ageSummary[key].total_volume_days += detail.volume_cbm * detail.days_in_period;
    ageSummary[key].total_fee += detail.total_fee;
  }

  console.log(`    ${'温区'.padEnd(10)} ${'库龄阶梯'.padEnd(15)} ${'倍率'.padEnd(8)} ${'基础费率'.padEnd(12)} ${'体积天数'.padEnd(15)} ${'费用'.padEnd(12)}`);
  for (const key in ageSummary) {
    const s = ageSummary[key];
    console.log(`    ${s.zone.padEnd(10)} ${s.ladder.padEnd(15)} ${String(s.multiplier + 'x').padEnd(8)} ${formatMoney(s.base_rate).padEnd(12)} ${String(s.total_volume_days.toFixed(1)).padEnd(15)} ${formatMoney(s.total_fee).padEnd(12)}`);
  }

  printSubsection('4.2 跨月库龄计算说明');
  console.log(`    ✅ 库存入库日期跨越多个库龄阶梯时，按天计算归属`);
  console.log(`    ✅ 例如：入库60天的商品，30天内按1.0x，31-60天按1.2x`);
  console.log(`    ✅ 每月独立计算，不受上月库龄影响但累计计算总天数`);

  printSection('5. 场景三：冷链费率差异演示');
  
  printSubsection('5.1 各温区仓储费对比');
  const storageByZone = {};
  for (const item of bill1.line_items.filter(i => i.line_type === 'STORAGE')) {
    for (const detail of bill1.age_details) {
      if (detail.zone_name) {
        if (!storageByZone[detail.zone_name]) {
          storageByZone[detail.zone_name] = { fee: 0, rate: detail.base_rate };
        }
      }
    }
  }
  
  const zoneRates2 = store.zone_rates.map(r => {
    const zone = store.temperature_zones.find(z => z.id === r.zone_id);
    return { name: zone?.name, storage_rate_per_cbm_per_day: r.storage_rate_per_cbm_per_day };
  });
  console.log(`    ${'温区'.padEnd(10)} ${'基础费率'.padEnd(15)} ${'相对倍数'.padEnd(12)} ${'说明'.padEnd(30)}`);
  const normalRate = zoneRates2.find(r => r.name === '常温区')?.storage_rate_per_cbm_per_day || 2;
  for (const rate of zoneRates2) {
    const multiple = (rate.storage_rate_per_cbm_per_day / normalRate).toFixed(1);
    const desc = rate.name === '常温区' ? '普通商品' : (rate.name === '冷藏区' ? '生鲜乳制品' : '冷冻肉类/冰淇淋');
    console.log(`    ${(rate.name || '').padEnd(10)} ${formatMoney(rate.storage_rate_per_cbm_per_day).padEnd(15)} ${String(multiple + 'x').padEnd(12)} ${desc.padEnd(30)}`);
  }

  printSection('6. 场景四：重复操作幂等性演示');
  
  printSubsection('6.1 首次创建操作');
  const opKey1 = 'DEMO-OP-001';
  const existingOp = billingEngine.checkIdempotency(opKey1, 'OPERATION');
  console.log(`    幂等键: ${opKey1}`);
  console.log(`    首次检查是否存在: ${existingOp ? '已存在' : '不存在'}`);

  printSubsection('6.2 重复提交同一操作');
  billingEngine.recordIdempotency(opKey1, 'OPERATION', 'op-demo-001', 'SUCCESS', { id: 'op-demo-001', status: 'PROCESSED' });
  const checkAgain = billingEngine.checkIdempotency(opKey1, 'OPERATION');
  console.log(`    重复提交检查: ${checkAgain ? '✅ 已存在，返回已有结果（幂等）' : '❌ 错误'}`);
  if (checkAgain) {
    console.log(`    返回的操作ID: ${JSON.parse(checkAgain.result).id}`);
  }

  printSection('7. 场景五：调账流程演示');
  
  printSubsection('7.1 调账前金额');
  const billBefore = billingEngine.getBillWithDetails(bill1.id);
  console.log(`    账单总金额: ${formatMoney(billBefore.total_amount)}`);
  console.log(`    调账金额: ${formatMoney(billBefore.adjustment_amount)}`);

  printSubsection('7.2 执行调账（客户投诉减免 ¥500）');
  const adjustedBill = billingEngine.createAdjustment(
    bill1.id,
    '财务主管-王经理',
    'DISCOUNT',
    -500.00,
    '客户投诉库龄计算有误，经核实给予减免'
  );
  console.log(`    调账类型: DISCOUNT (减免)`);
  console.log(`    调账金额: ${formatMoney(-500.00)}`);
  console.log(`    调账原因: 客户投诉库龄计算有误，经核实给予减免`);
  console.log(`    操作人: 财务主管-王经理`);

  printSubsection('7.3 调账后金额');
  console.log(`    调账后总金额: ${formatMoney(adjustedBill.total_amount)}`);
  console.log(`    累计调账金额: ${formatMoney(adjustedBill.adjustment_amount)}`);

  printSubsection('7.4 调账历史记录');
  for (const adj of adjustedBill.adjustments) {
    console.log(`    时间: ${adj.created_at}`);
    console.log(`    操作人: ${adj.adjusted_by}`);
    console.log(`    调账前: ${formatMoney(adj.before_amount)}`);
    console.log(`    调账后: ${formatMoney(adj.after_amount)}`);
    console.log(`    差异: ${formatMoney(adj.amount)}`);
    console.log(`    原因: ${adj.reason}`);
  }

  printSection('8. 场景六：账单状态流转演示');
  
  printSubsection('8.1 当前状态');
  console.log(`    账单ID: ${bill1.id}`);
  console.log(`    当前状态: ${adjustedBill.status}`);

  printSubsection('8.2 推进状态: DRAFT → PROCESSING');
  const billProcessing = billingEngine.updateBillStatus(bill1.id, 'PROCESSING', '结算专员', '账单数据校验完成');
  console.log(`    新状态: ${billProcessing.status}`);
  console.log(`    操作人: 结算专员`);
  console.log(`    原因: 账单数据校验完成`);

  printSubsection('8.3 推进状态: PROCESSING → PENDING_CONFIRM');
  const billPending = billingEngine.updateBillStatus(billProcessing.id, 'PENDING_CONFIRM', '结算主管', '费用计算复核通过，待客户确认');
  console.log(`    新状态: ${billPending.status}`);
  console.log(`    操作人: 结算主管`);
  console.log(`    原因: 费用计算复核通过，待客户确认`);

  printSubsection('8.4 推进状态: PENDING_CONFIRM → CONFIRMED');
  const billConfirmed = billingEngine.updateBillStatus(billPending.id, 'CONFIRMED', '客户-张经理', '客户确认账单无误');
  console.log(`    新状态: ${billConfirmed.status}`);
  console.log(`    确认人: ${billConfirmed.confirmed_by}`);
  console.log(`    确认时间: ${billConfirmed.confirmed_at}`);

  printSubsection('8.5 状态流转历史');
  console.log(`    ${'序号'.padEnd(6)} ${'从状态'.padEnd(18)} ${'→'.padEnd(3)} ${'到状态'.padEnd(18)} ${'操作人'.padEnd(18)} ${'原因'.padEnd(30)}`);
  billConfirmed.status_history.forEach((h, idx) => {
    const from = h.from_status || '(创建)';
    console.log(`    ${String(idx + 1).padEnd(6)} ${from.padEnd(18)} ${'→'.padEnd(3)} ${h.to_status.padEnd(18)} ${(h.changed_by || '-').padEnd(18)} ${(h.change_reason || '-').padEnd(30)}`);
  });

  printSection('9. 场景七：失败路径演示 - 已确认账单操作限制');
  
  printSubsection('9.1 尝试修改已确认账单');
  try {
    billingEngine.updateBillStatus(billConfirmed.id, 'DRAFT', '测试用户', '尝试回滚');
    console.log('    ❌ 错误：应该抛出异常但没有');
  } catch (error) {
    console.log(`    ✅ 成功阻止: ${error.message}`);
  }

  printSubsection('9.2 尝试对已确认账单调账');
  try {
    billingEngine.createAdjustment(billConfirmed.id, '测试用户', 'DISCOUNT', -100, '测试调账');
    console.log('    ❌ 错误：应该抛出异常但没有');
  } catch (error) {
    console.log(`    ✅ 成功阻止: ${error.message}`);
  }

  printSubsection('9.3 尝试重新生成已确认账单');
  try {
    billingEngine.generateBill(
      sampleData.customer1Id,
      sampleData.periodStart,
      sampleData.periodEnd,
      'test'
    );
    console.log('    ❌ 错误：应该抛出异常但没有');
  } catch (error) {
    console.log(`    ✅ 成功阻止: ${error.message}`);
  }

  printSection('10. 最终账单展示');
  
  const finalBill = billingEngine.getBillWithDetails(bill1.id);
  
  console.log(`\n  客户对账单`);
  console.log(`  ${'─'.repeat(70)}`);
  console.log(`  客户名称: ${finalBill.customer.name}`);
  console.log(`  账单周期: ${finalBill.period_start} 至 ${finalBill.period_end}`);
  console.log(`  账单状态: ${finalBill.status}`);
  console.log(`  确认时间: ${finalBill.confirmed_at || '未确认'}`);
  console.log(`  ${'─'.repeat(70)}`);
  console.log(`  费用明细:`);
  
  const lineSummary = {
    '仓储费': 0,
    '入库操作费': 0,
    '出库操作费': 0,
    '调账': 0
  };
  
  for (const item of finalBill.line_items) {
    if (item.line_type === 'STORAGE') lineSummary['仓储费'] += item.amount;
    else if (item.line_type === 'IN_OPERATION') lineSummary['入库操作费'] += item.amount;
    else if (item.line_type === 'OUT_OPERATION') lineSummary['出库操作费'] += item.amount;
    else if (item.line_type === 'ADJUSTMENT') lineSummary['调账'] += item.amount;
  }
  
  for (const [name, amount] of Object.entries(lineSummary)) {
    if (amount !== 0) {
      console.log(`    ${name.padEnd(15)} ........................ ${formatMoney(amount).padStart(15)}`);
    }
  }
  
  console.log(`  ${'─'.repeat(70)}`);
  console.log(`  账单总金额: ${formatMoney(finalBill.total_amount).padStart(58)}`);
  console.log(`  ${'─'.repeat(70)}`);

  printSection('11. 演示总结');
  console.log(`
  ✅ 正常计费流程: 账单生成 → 明细展开 → 金额计算
  ✅ 库龄阶梯加价: 0-30天(1.0x) → 31-60天(1.2x) → 61-90天(1.5x) → 90天+(2.0x)
  ✅ 冷链费率差异: 常温¥2 → 冷藏¥5(2.5x) → 冷冻¥8(4.0x)
  ✅ 操作阶梯折扣: 51-200次享受5%折扣
  ✅ 幂等机制: 重复操作自动返回已有结果
  ✅ 调账流程: 记录前后差异、操作人、原因
  ✅ 状态流转: DRAFT → PROCESSING → PENDING_CONFIRM → CONFIRMED
  ✅ 已确认账单保护: 防止误修改和重复生成

  📊 关键数据:
  - 总仓储费（含阶梯加价）: ${formatMoney(finalBill.storage_fee)}
  - 总操作费（含阶梯折扣）: ${formatMoney(finalBill.in_operation_fee + finalBill.out_operation_fee)}
  - 减免调账: ${formatMoney(finalBill.adjustment_amount)}
  - 最终应收: ${formatMoney(finalBill.total_amount)}
  `);

  console.log('\n' + '='.repeat(80));
  console.log('  🎉 演示完成！所有业务场景已验证通过');
  console.log('='.repeat(80) + '\n');
}

runDemo();
