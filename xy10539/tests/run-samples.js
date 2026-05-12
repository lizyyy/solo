const {
  store,
  createAnchor,
  createGuild,
  createSettlementRule,
  createFreeze,
  createRefund,
  STATUS
} = require('../src/models/store');
const {
  processGiftWithIdempotency,
  processGiftToSettlement,
  finalizeSettlement,
  manualCorrect,
  generateSettlementReport,
  generateAnchorExplanationReport,
  getSettlementPeriod
} = require('../src/engine/settlementEngine');

function logSection(title) {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(`  ${title}`);
  console.log('═══════════════════════════════════════════');
  console.log('');
}

function logSubSection(title) {
  console.log('');
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${title}`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('');
}

function logResult(label, value, highlight = false) {
  const prefix = highlight ? '  ★ ' : '  → ';
  if (typeof value === 'object') {
    console.log(`${prefix}${label}:`);
    console.log(`      ${JSON.stringify(value, null, 2).split('\n').join('\n      ')}`);
  } else {
    console.log(`${prefix}${label}: ${value}`);
  }
}

function assertEqual(actual, expected, message) {
  const pass = actual === expected;
  const symbol = pass ? '✓' : '✗';
  console.log(`  ${symbol} ${message}`);
  if (!pass) {
    console.log(`    期望: ${expected}, 实际: ${actual}`);
    process.exitCode = 1;
  }
  return pass;
}

function cleanupStore() {
  Object.keys(store.anchors).forEach(k => delete store.anchors[k]);
  Object.keys(store.guilds).forEach(k => delete store.guilds[k]);
  Object.keys(store.gifts).forEach(k => delete store.gifts[k]);
  Object.keys(store.settlementRules).forEach(k => delete store.settlementRules[k]);
  Object.keys(store.freezes).forEach(k => delete store.freezes[k]);
  Object.keys(store.refunds).forEach(k => delete store.refunds[k]);
  Object.keys(store.settlements).forEach(k => delete store.settlements[k]);
  store.auditLogs = [];
}

function scenario1_NormalSettlement() {
  logSection('场景 1: 正常分账');
  logSubSection('场景描述: 主播加入公会，接收礼物，按比例分账');
  
  cleanupStore();
  
  const guild = createGuild({ name: '星辰公会' });
  logResult('创建公会', { id: guild.id, name: guild.name });
  
  const anchor = createAnchor({ 
    name: '主播小明', 
    guildId: guild.id 
  });
  logResult('创建主播', { id: anchor.id, name: anchor.name, guild: '星辰公会' });
  
  const rule = createSettlementRule({
    guildId: guild.id,
    effectiveDate: '2024-01-01T00:00:00.000Z',
    anchorRatio: 0.50,
    guildRatio: 0.20,
    platformRatio: 0.30
  });
  logResult('分账规则', {
    anchor: '50%',
    guild: '20%',
    platform: '30%'
  });
  
  logSubSection('提交礼物');
  
  const gift1 = processGiftWithIdempotency({
    streamerId: anchor.id,
    guildId: guild.id,
    giftType: '火箭',
    amount: 5,
    unitPrice: 100,
    timestamp: '2024-06-10T20:00:00.000Z'
  });
  logResult('礼物1', { 
    type: '火箭', 
    数量: 5, 
    单价: 100, 
    总价值: gift1.gift.totalValue 
  });
  processGiftToSettlement(gift1.gift);
  
  const gift2 = processGiftWithIdempotency({
    streamerId: anchor.id,
    guildId: guild.id,
    giftType: '小心心',
    amount: 100,
    unitPrice: 1,
    timestamp: '2024-06-11T21:30:00.000Z'
  });
  logResult('礼物2', { 
    type: '小心心', 
    数量: 100, 
    单价: 1, 
    总价值: gift2.gift.totalValue 
  });
  processGiftToSettlement(gift2.gift);
  
  const period = getSettlementPeriod('2024-06-10T20:00:00.000Z');
  logResult('结算账期', period);
  
  const settlements = Object.values(store.settlements).filter(
    s => s.anchorId === anchor.id
  );
  const settlement = settlements[0];
  
  logSubSection('分账计算明细');
  logResult('礼物总收入', `¥${settlement.calculations.totalGiftValue.toFixed(2)}`);
  logResult('主播分成 (50%)', `¥${settlement.calculations.anchorShare.toFixed(2)}`, true);
  logResult('公会分成 (20%)', `¥${settlement.calculations.guildShare.toFixed(2)}`);
  logResult('平台分成 (30%)', `¥${settlement.calculations.platformShare.toFixed(2)}`);
  
  logSubSection('完成结算');
  const finalized = finalizeSettlement(settlement.id);
  logResult('最终状态', finalized.status);
  logResult('可打款金额', `¥${finalized.calculations.netPayable.toFixed(2)}`, true);
  
  logSubSection('生成主播解释报告');
  const explanation = generateAnchorExplanationReport(settlement.id);
  for (const section of explanation.explanation) {
    console.log(`  【${section.title}】`);
    console.log(`    ${section.content.split('\n').join('\n    ')}`);
  }
  
  logSubSection('验证结果');
  assertEqual(
    settlement.calculations.totalGiftValue, 
    600, 
    '总礼物价值应为 600 (500火箭 + 100小心心)'
  );
  assertEqual(
    settlement.calculations.anchorShare, 
    300, 
    '主播分成应为 300 (600 × 50%)'
  );
  assertEqual(
    settlement.calculations.guildShare, 
    120, 
    '公会分成应为 120 (600 × 20%)'
  );
  assertEqual(
    settlement.calculations.platformShare, 
    180, 
    '平台分成应为 180 (600 × 30%)'
  );
  assertEqual(
    finalized.status, 
    STATUS.SETTLEMENT.COMPLETED, 
    '结算状态应为 COMPLETED'
  );
  assertEqual(
    finalized.calculations.netPayable, 
    300, 
    '可打款金额应为 300'
  );
}

function scenario2_FreezeDuringViolation() {
  logSection('场景 2: 违规冻结');
  logSubSection('场景描述: 主播违规，违规期间礼物全部冻结');
  
  cleanupStore();
  
  const guild = createGuild({ name: '月光公会' });
  const anchor = createAnchor({ 
    name: '违规主播小红', 
    guildId: guild.id 
  });
  
  const rule = createSettlementRule({
    guildId: guild.id,
    effectiveDate: '2024-01-01T00:00:00.000Z',
    anchorRatio: 0.50,
    guildRatio: 0.20,
    platformRatio: 0.30
  });
  
  logSubSection('创建冻结记录');
  const freeze = createFreeze({
    anchorId: anchor.id,
    reason: '直播内容违规，涉嫌低俗',
    freezeStart: '2024-06-05T00:00:00.000Z',
    freezeEnd: '2024-06-20T23:59:59.999Z'
  });
  logResult('冻结原因', freeze.reason);
  logResult('冻结期间', `${freeze.freezeStart} ~ ${freeze.freezeEnd}`);
  
  logSubSection('违规期间接收礼物');
  const giftResult = processGiftWithIdempotency({
    streamerId: anchor.id,
    guildId: guild.id,
    giftType: '超级火箭',
    amount: 10,
    unitPrice: 500,
    timestamp: '2024-06-10T20:00:00.000Z'
  });
  logResult('礼物信息', { 
    type: '超级火箭', 
    数量: 10, 
    总价值: giftResult.gift.totalValue 
  });
  
  const settlement = processGiftToSettlement(giftResult.gift);
  
  logSubSection('分账结果');
  logResult('礼物总收入', `¥${settlement.calculations.totalGiftValue.toFixed(2)}`);
  logResult('冻结金额', `¥${settlement.calculations.freezeAmount.toFixed(2)}`, true);
  logResult('主播分成', `¥${settlement.calculations.anchorShare.toFixed(2)}`);
  logResult('公会分成', `¥${settlement.calculations.guildShare.toFixed(2)}`);
  logResult('平台分成', `¥${settlement.calculations.platformShare.toFixed(2)}`);
  logResult('礼物状态', giftResult.gift.status);
  
  logSubSection('完成结算');
  const finalized = finalizeSettlement(settlement.id);
  logResult('结算状态', finalized.status);
  logResult('可打款金额', `¥${finalized.calculations.netPayable.toFixed(2)}`);
  
  logSubSection('生成主播解释报告');
  const explanation = generateAnchorExplanationReport(settlement.id);
  for (const section of explanation.explanation) {
    console.log(`  【${section.title}】`);
    console.log(`    ${section.content.split('\n').join('\n    ')}`);
  }
  
  logSubSection('验证结果');
  assertEqual(
    settlement.calculations.totalGiftValue, 
    5000, 
    '总礼物价值应为 5000'
  );
  assertEqual(
    settlement.calculations.freezeAmount, 
    5000, 
    '冻结金额应为 5000 (违规期间全部冻结)'
  );
  assertEqual(
    settlement.calculations.anchorShare, 
    0, 
    '主播分成应为 0 (已冻结)'
  );
  assertEqual(
    giftResult.gift.status, 
    STATUS.GIFT.FROZEN, 
    '礼物状态应为 FROZEN'
  );
  assertEqual(
    finalized.status, 
    STATUS.SETTLEMENT.FROZEN, 
    '结算状态应为 FROZEN'
  );
}

function scenario3_RefundAcrossPeriods() {
  logSection('场景 3: 退款跨账期');
  logSubSection('场景描述: 本期退款冲抵下期结算款');
  
  cleanupStore();
  
  const guild = createGuild({ name: '阳光公会' });
  const anchor = createAnchor({ 
    name: '主播小华', 
    guildId: guild.id 
  });
  
  const rule = createSettlementRule({
    guildId: guild.id,
    effectiveDate: '2024-01-01T00:00:00.000Z',
    anchorRatio: 0.50,
    guildRatio: 0.20,
    platformRatio: 0.30
  });
  
  logSubSection('上期 (6月上半月) - 正常结算');
  const giftResult = processGiftWithIdempotency({
    streamerId: anchor.id,
    guildId: guild.id,
    giftType: '火箭',
    amount: 10,
    unitPrice: 100,
    timestamp: '2024-06-10T20:00:00.000Z'
  });
  logResult('上期礼物', { 总价值: giftResult.gift.totalValue });
  
  const period1Settlement = processGiftToSettlement(giftResult.gift);
  const finalized1 = finalizeSettlement(period1Settlement.id);
  
  logResult('上期可打款金额', `¥${finalized1.calculations.netPayable.toFixed(2)}`);
  logResult('上期结算状态', finalized1.status);
  
  logSubSection('本期 (6月下半月) - 有退款');
  
  const gift2Result = processGiftWithIdempotency({
    streamerId: anchor.id,
    guildId: guild.id,
    giftType: '飞机',
    amount: 5,
    unitPrice: 100,
    timestamp: '2024-06-20T20:00:00.000Z'
  });
  logResult('本期新礼物', { 总价值: gift2Result.gift.totalValue });
  
  const period2Settlement = processGiftToSettlement(gift2Result.gift);
  
  logSubSection('创建退款（用户退回上期的火箭）');
  const refund = createRefund({
    giftId: giftResult.gift.id,
    originalPeriod: '2024-06-01',
    refundPeriod: '2024-06-16',
    amount: 500,
    reason: '用户误操作，申请退款'
  });
  logResult('退款金额', `¥${refund.amount.toFixed(2)}`);
  logResult('退款原账期', refund.originalPeriod);
  logResult('退款冲抵账期', refund.refundPeriod);
  
  logSubSection('完成本期结算');
  const finalized2 = finalizeSettlement(period2Settlement.id);
  
  logResult('本期礼物收入', `¥${finalized2.calculations.totalGiftValue.toFixed(2)}`);
  logResult('本期主播分成', `¥${finalized2.calculations.anchorShare.toFixed(2)}`);
  logResult('退款冲抵', `¥${Math.abs(finalized2.calculations.refundAdjustment).toFixed(2)}`, true);
  logResult('可打款金额', `¥${finalized2.calculations.netPayable.toFixed(2)}`);
  
  logSubSection('生成主播解释报告');
  const explanation = generateAnchorExplanationReport(period2Settlement.id);
  for (const section of explanation.explanation) {
    console.log(`  【${section.title}】`);
    console.log(`    ${section.content.split('\n').join('\n    ')}`);
  }
  
  logSubSection('验证结果');
  assertEqual(
    period1Settlement.calculations.totalGiftValue, 
    1000, 
    '上期总礼物价值应为 1000'
  );
  assertEqual(
    period2Settlement.calculations.totalGiftValue, 
    500, 
    '本期总礼物价值应为 500'
  );
  assertEqual(
    period2Settlement.calculations.anchorShare, 
    250, 
    '本期主播分成应为 250 (500 × 50%)'
  );
  assertEqual(
    period2Settlement.calculations.refundAdjustment, 
    -500, 
    '退款调整应为 -500'
  );
  assertEqual(
    finalized2.calculations.netPayable, 
    0, 
    '可打款金额应为 0 (退款超过本期收入)'
  );
  assertEqual(
    finalized2.calculations.nextCarryover < 0, 
    true, 
    '负余额应结转至下期'
  );
}

function scenario4_RatioChange() {
  logSection('场景 4: 公会比例变更');
  logSubSection('场景描述: 公会调整分账比例，不同时间点礼物按不同比例计算');
  
  cleanupStore();
  
  const guild = createGuild({ name: '风云公会' });
  const anchor = createAnchor({ 
    name: '主播小强', 
    guildId: guild.id 
  });
  
  logSubSection('初始分账规则');
  const rule1 = createSettlementRule({
    guildId: guild.id,
    effectiveDate: '2024-01-01T00:00:00.000Z',
    endDate: '2024-06-14T23:59:59.999Z',
    anchorRatio: 0.50,
    guildRatio: 0.20,
    platformRatio: 0.30
  });
  logResult('规则1 (6月1-14日)', {
    anchor: '50%',
    guild: '20%',
    platform: '30%'
  });
  
  logSubSection('比例上调（公会让利给主播）');
  const rule2 = createSettlementRule({
    guildId: guild.id,
    effectiveDate: '2024-06-15T00:00:00.000Z',
    anchorRatio: 0.55,
    guildRatio: 0.15,
    platformRatio: 0.30
  });
  logResult('规则2 (6月15日起)', {
    anchor: '55%',
    guild: '15%',
    platform: '30%'
  }, true);
  
  logSubSection('6月10日礼物 (用旧规则 50%)');
  const gift1 = processGiftWithIdempotency({
    streamerId: anchor.id,
    guildId: guild.id,
    giftType: '火箭',
    amount: 10,
    unitPrice: 100,
    timestamp: '2024-06-10T20:00:00.000Z'
  });
  logResult('礼物1 (旧规则)', { 
    总价值: gift1.gift.totalValue,
    时间: '6月10日'
  });
  const settlement1 = processGiftToSettlement(gift1.gift);
  
  logSubSection('6月20日礼物 (用新规则 55%)');
  const gift2 = processGiftWithIdempotency({
    streamerId: anchor.id,
    guildId: guild.id,
    giftType: '火箭',
    amount: 10,
    unitPrice: 100,
    timestamp: '2024-06-20T20:00:00.000Z'
  });
  logResult('礼物2 (新规则)', { 
    总价值: gift2.gift.totalValue,
    时间: '6月20日'
  });
  const settlement2 = processGiftToSettlement(gift2.gift);
  
  logSubSection('分账对比');
  logResult('旧规则 (6/10)', {
    主播: `¥${settlement1.calculations.anchorShare.toFixed(2)} (50%)`,
    公会: `¥${settlement1.calculations.guildShare.toFixed(2)} (20%)`
  });
  logResult('新规则 (6/20)', {
    主播: `¥${settlement2.calculations.anchorShare.toFixed(2)} (55%)`,
    公会: `¥${settlement2.calculations.guildShare.toFixed(2)} (15%)`
  }, true);
  
  logSubSection('验证结果');
  assertEqual(
    settlement1.calculations.anchorShare, 
    500, 
    '旧规则主播分成应为 500 (1000 × 50%)'
  );
  assertEqual(
    settlement1.calculations.guildShare, 
    200, 
    '旧规则公会分成应为 200 (1000 × 20%)'
  );
  assertEqual(
    settlement2.calculations.anchorShare, 
    550, 
    '新规则主播分成应为 550 (1000 × 55%)'
  );
  assertEqual(
    settlement2.calculations.guildShare, 
    150, 
    '新规则公会分成应为 150 (1000 × 15%)'
  );
}

function scenario5_IdempotentDuplicate() {
  logSection('场景 5: 重复回调幂等性');
  logSubSection('场景描述: 同一礼物重复回调，系统保证只处理一次');
  
  cleanupStore();
  
  const guild = createGuild({ name: '测试公会' });
  const anchor = createAnchor({ 
    name: '幂等测试主播', 
    guildId: guild.id 
  });
  
  const rule = createSettlementRule({
    guildId: guild.id,
    effectiveDate: '2024-01-01T00:00:00.000Z',
    anchorRatio: 0.50,
    guildRatio: 0.20,
    platformRatio: 0.30
  });
  
  const giftData = {
    streamerId: anchor.id,
    guildId: guild.id,
    giftType: '火箭',
    amount: 5,
    unitPrice: 100,
    timestamp: '2024-06-10T20:00:00.000Z'
  };
  
  logSubSection('第一次回调');
  const result1 = processGiftWithIdempotency(giftData);
  logResult('是否重复', result1.isDuplicate);
  logResult('礼物ID', result1.gift.id);
  
  logSubSection('第二次回调 (完全相同的数据)');
  const result2 = processGiftWithIdempotency(giftData);
  logResult('是否重复', result2.isDuplicate, true);
  logResult('礼物ID', result2.gift.id);
  
  logSubSection('验证幂等性');
  assertEqual(result1.isDuplicate, false, '第一次不应是重复');
  assertEqual(result2.isDuplicate, true, '第二次应识别为重复');
  assertEqual(result1.gift.id, result2.gift.id, '两次返回同一个礼物ID');
  
  logSubSection('验证结算只处理一次');
  processGiftToSettlement(result1.gift);
  processGiftToSettlement(result2.gift);
  
  const settlements = Object.values(store.settlements);
  const settlement = settlements[0];
  
  logResult('礼物数量', settlement.giftIds.length);
  logResult('总价值', `¥${settlement.calculations.totalGiftValue.toFixed(2)}`);
  
  assertEqual(settlement.giftIds.length, 1, '结算单中只应有1个礼物');
  assertEqual(settlement.calculations.totalGiftValue, 500, '总价值应为 500，而非 1000');
  
  logSubSection('审计日志');
  const duplicateLogs = store.auditLogs.filter(
    l => l.action === 'IDEMPOTENT_DUPLICATE'
  );
  logResult('重复回调日志数', duplicateLogs.length);
  assertEqual(duplicateLogs.length, 1, '应有1条重复回调审计日志');
}

function scenario6_FailurePath() {
  logSection('场景 6: 失败路径 - 无分账规则导致结算失败');
  logSubSection('场景描述: 主播接收礼物但没有配置分账规则，结算失败');
  
  cleanupStore();
  
  const anchor = createAnchor({ 
    name: '无规则主播',
    guildId: null
  });
  
  logSubSection('提交礼物（无分账规则）');
  const giftData = {
    streamerId: anchor.id,
    guildId: null,
    giftType: '火箭',
    amount: 5,
    unitPrice: 100,
    timestamp: '2024-06-10T20:00:00.000Z'
  };
  
  logResult('尝试处理礼物', '执行中...');
  
  const giftResult = processGiftWithIdempotency(giftData);
  logResult('礼物创建成功', giftResult.gift.id);
  
  let errorOccurred = false;
  let settlement = null;
  
  try {
    settlement = processGiftToSettlement(giftResult.gift);
  } catch (error) {
    errorOccurred = true;
    logResult('捕获到错误', error.message, true);
  }
  
  logSubSection('查看异常列表');
  const exceptions = Object.values(store.settlements).filter(
    s => s.status === STATUS.SETTLEMENT.FAILED
  );
  logResult('异常结算数', exceptions.length);
  
  if (exceptions.length > 0) {
    const failedSettlement = exceptions[0];
    logResult('失败原因', failedSettlement.history[failedSettlement.history.length - 1]?.details?.reason || '未知');
    logResult('历史记录', failedSettlement.history.map(h => `${h.event}: ${JSON.stringify(h.details)}`));
  }
  
  logSubSection('重试机制');
  
  const failed = Object.values(store.settlements).find(s => s.status === STATUS.SETTLEMENT.FAILED);
  if (failed) {
    logResult('结算ID', failed.id);
    logResult('当前状态', failed.status);
    
    logResult('人工补充分账规则', '执行中...');
    const rule = createSettlementRule({
      anchorId: anchor.id,
      effectiveDate: '2024-01-01T00:00:00.000Z',
      anchorRatio: 0.60,
      guildRatio: 0,
      platformRatio: 0.40
    });
    logResult('规则已创建', { anchor: '60%', platform: '40%' });
    
    logResult('重试处理', '执行中...');
    try {
      for (const giftId of failed.giftIds) {
        const gift = store.gifts[giftId];
        if (gift) {
          processGiftToSettlement(gift);
        }
      }
      
      const finalized = finalizeSettlement(failed.id);
      logResult('重试后状态', finalized.status, true);
      logResult('可打款金额', `¥${finalized.calculations.netPayable.toFixed(2)}`);
      
      assertEqual(finalized.status, STATUS.SETTLEMENT.COMPLETED, '重试后应成功完成');
      assertEqual(finalized.calculations.anchorShare, 300, '主播分成为 300 (500 × 60%)');
    } catch (error) {
      logResult('重试失败', error.message);
    }
  }
  
  logSubSection('验证结果');
  assertEqual(errorOccurred, true, '应捕获到错误');
}

function scenario7_ManualCorrection() {
  logSection('场景 7: 人工修正');
  logSubSection('场景描述: 运营人员人工修正结算金额，记录前后差异和操作者');
  
  cleanupStore();
  
  const guild = createGuild({ name: '修正测试公会' });
  const anchor = createAnchor({ 
    name: '需要修正的主播', 
    guildId: guild.id 
  });
  
  const rule = createSettlementRule({
    guildId: guild.id,
    effectiveDate: '2024-01-01T00:00:00.000Z',
    anchorRatio: 0.50,
    guildRatio: 0.20,
    platformRatio: 0.30
  });
  
  const giftResult = processGiftWithIdempotency({
    streamerId: anchor.id,
    guildId: guild.id,
    giftType: '火箭',
    amount: 10,
    unitPrice: 100,
    timestamp: '2024-06-10T20:00:00.000Z'
  });
  
  const settlement = processGiftToSettlement(giftResult.gift);
  const finalized = finalizeSettlement(settlement.id);
  
  logSubSection('修正前');
  logResult('可打款金额', `¥${finalized.calculations.netPayable.toFixed(2)}`);
  
  logSubSection('人工修正（运营经理张经理）');
  const correction = manualCorrect(
    settlement.id,
    { anchorShare: 600, platformShare: 200 },
    'ZHANG_MANAGER'
  );
  
  logResult('修正记录', {
    操作人: correction.operator,
    修正内容: correction.corrections
  });
  
  logResult('修正前', correction.before);
  logResult('修正后', correction.after, true);
  
  logSubSection('查看修正后的结算');
  const updatedSettlement = store.settlements[settlement.id];
  logResult('新的可打款金额', `¥${updatedSettlement.calculations.netPayable.toFixed(2)}`);
  logResult('修正记录数', updatedSettlement.manualCorrections.length);
  
  logSubSection('审计日志');
  const correctionLogs = store.auditLogs.filter(
    l => l.action === 'MANUAL_CORRECTION'
  );
  for (const log of correctionLogs) {
    logResult('审计记录', {
      操作人: log.operator,
      实体: log.entityType,
      详情: log.details
    });
  }
  
  logSubSection('验证结果');
  assertEqual(correction.operator, 'ZHANG_MANAGER', '操作者应记录为 ZHANG_MANAGER');
  assertEqual(correction.corrections.length, 2, '应修正2个字段');
  assertEqual(
    updatedSettlement.calculations.anchorShare, 
    600, 
    '修正后主播分成为 600'
  );
}

function runAllScenarios() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║       直播礼物分账 API - 完整演示脚本                       ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  内置样例场景:');
  console.log('  1. 正常分账 - 主播、公会、平台按比例分账');
  console.log('  2. 违规冻结 - 违规期间收入全部冻结');
  console.log('  3. 退款跨账期 - 退款冲抵下期结算款');
  console.log('  4. 比例变更 - 不同时间点按不同规则计算');
  console.log('  5. 重复回调 - 幂等性保证');
  console.log('  6. 失败路径 - 无规则导致失败及重试机制');
  console.log('  7. 人工修正 - 记录前后差异和操作者');
  console.log('');
  
  const start = Date.now();
  
  try {
    scenario1_NormalSettlement();
    scenario2_FreezeDuringViolation();
    scenario3_RefundAcrossPeriods();
    scenario4_RatioChange();
    scenario5_IdempotentDuplicate();
    scenario6_FailurePath();
    scenario7_ManualCorrection();
    
    const duration = Date.now() - start;
    
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║                    所有场景执行完成！                        ║');
    console.log('║                                                            ║');
    console.log(`║  执行时间: ${duration}ms                                          ║`);
    console.log('║                                                            ║');
    console.log('║  查看详情:                                                  ║');
    console.log('║  - 启动服务: npm start                                      ║');
    console.log('║  - 仪表盘: GET /api/dashboard                               ║');
    console.log('║  - 审计日志: GET /api/audit-logs                            ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('✗ 执行出错:', error.message);
    console.error(error.stack);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runAllScenarios();
}

module.exports = {
  runAllScenarios,
  scenario1_NormalSettlement,
  scenario2_FreezeDuringViolation,
  scenario3_RefundAcrossPeriods,
  scenario4_RatioChange,
  scenario5_IdempotentDuplicate,
  scenario6_FailurePath,
  scenario7_ManualCorrection
};
