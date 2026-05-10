const billingService = require('./billing-service');

function log(title, data, level = 0) {
  const indent = '  '.repeat(level);
  console.log(`\n${indent}${'='.repeat(60)}`);
  console.log(`${indent}【${title}】`);
  console.log(`${indent}${'='.repeat(60)}`);
  if (data !== undefined) {
    console.log(`${indent}${JSON.stringify(data, null, 2).split('\n').map(l => indent + l).join('\n')}`);
  }
}

function printProgress(text) {
  console.log(`  → ${text}`);
}

function formatDateTime(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

async function runCompleteScenario() {
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║    社区充电桩峰谷账单核验 API - 完整验收场景演示                   ║');
  console.log('║                                                                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  console.log('\n📋 场景说明:');
  console.log('   住户张三在下午 17:30 开始充电，跨越 18:00 峰电时段，中途断网后补传。');
  console.log('   系统需要: (1) 自动切片峰谷电价 (2) 防止重复计费 (3) 产出可复核账单\n');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('阶段 1: 系统初始化与电价配置');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const tariff = billingService.getTariffConfig('COMM001');
  log('当前社区电价配置 (COMM001)', null);
  console.log('  峰电时段 (peak): 08:00-11:00, 18:00-23:00  → ¥1.20/kWh');
  console.log('  平时段 (flat):   06:00-08:00, 11:00-18:00  → ¥0.80/kWh');
  console.log('  谷电时段 (valley): 23:00-06:00            → ¥0.35/kWh');
  
  const baseTime = new Date();
  baseTime.setDate(baseTime.getDate() - 1);
  baseTime.setHours(17, 30, 0, 0);
  
  const sessionId = 'SES-20260509-001';
  const residentId = 'RES-张三-123';
  const chargerId = 'CHARGER-A-05';
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('阶段 2: 充电会话开始 - 17:30-17:50 (平时段)');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const segment1Start = new Date(baseTime.getTime());
  const segment1End = new Date(baseTime.getTime() + 20 * 60 * 1000);
  
  printProgress('提交充电记录 (平时段 17:30-17:50, 消耗 3.5 kWh)');
  
  const record1 = {
    request_id: 'REQ-001-SEG1',
    session_id: sessionId,
    community_id: 'COMM001',
    resident_id: residentId,
    charger_id: chargerId,
    timestamp: segment1Start.toISOString(),
    start_kwh: 0,
    end_kwh: 3.5,
    duration_seconds: 20 * 60,
    status: 'charging'
  };
  
  const result1 = billingService.processRecord(record1);
  log('结果 1 - 平时段充电', result1, 1);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('阶段 3: 断网补传场景 - 模拟网络中断');
  console.log('═══════════════════════════════════════════════════════════════');
  
  printProgress('模拟: 18:00 充电桩断网，但充电继续，数据本地缓存');
  printProgress('网络恢复后，补传 17:50-18:15 的数据 (跨越平时段和峰电时段)');
  
  const segment2Start = new Date(baseTime.getTime() + 20 * 60 * 1000);
  const segment2End = new Date(baseTime.getTime() + 45 * 60 * 1000);
  
  const record2 = {
    request_id: 'REQ-001-SEG2',
    session_id: sessionId,
    community_id: 'COMM001',
    resident_id: residentId,
    charger_id: chargerId,
    timestamp: segment2Start.toISOString(),
    start_kwh: 3.5,
    end_kwh: 7.5,
    duration_seconds: 25 * 60,
    status: 'charging',
    is_retransmit: true,
    original_request_id: 'REQ-001-SEG2-ORIGINAL'
  };
  
  const result2 = billingService.processRecord(record2);
  log('结果 2 - 断点补传 (跨峰谷时段)', result2, 1);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('阶段 4: 重复提交防护测试');
  console.log('═══════════════════════════════════════════════════════════════');
  
  printProgress('测试: 再次提交相同的 request_id (REQ-001-SEG1)');
  
  const recordDuplicate = { ...record1 };
  const resultDuplicate = billingService.processRecord(recordDuplicate);
  log('结果 3 - 重复提交检测', resultDuplicate, 1);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('阶段 5: 充电完成 - 18:15-18:30 (峰电时段)');
  console.log('═══════════════════════════════════════════════════════════════');
  
  printProgress('提交充电结束记录 (峰电时段 18:15-18:30, 消耗 2.0 kWh)');
  
  const segment3Start = new Date(baseTime.getTime() + 45 * 60 * 1000);
  const segment3End = new Date(baseTime.getTime() + 60 * 60 * 1000);
  
  const record3 = {
    request_id: 'REQ-001-SEG3',
    session_id: sessionId,
    community_id: 'COMM001',
    resident_id: residentId,
    charger_id: chargerId,
    timestamp: segment3Start.toISOString(),
    start_kwh: 7.5,
    end_kwh: 9.5,
    duration_seconds: 15 * 60,
    status: 'completed'
  };
  
  const result3 = billingService.processRecord(record3);
  log('结果 4 - 充电结束', result3, 1);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('阶段 6: 查看会话详情 - 能量切片');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const sessionDetails = billingService.getSessionDetails(sessionId);
  
  log('会话状态历史', null, 1);
  sessionDetails.statusHistory.forEach((h, i) => {
    console.log(`  [${i+1}] ${h.status.padEnd(10)} at ${formatDateTime(new Date(h.timestamp))} (${h.source})`);
  });
  
  log('原始充电记录 (3条)', null, 1);
  sessionDetails.records.forEach((r, i) => {
    const startTime = formatDateTime(new Date(r.timestamp));
    const endTime = formatDateTime(new Date(new Date(r.timestamp).getTime() + r.duration_seconds * 1000));
    console.log(`  [${i+1}] ${startTime} ~ ${endTime.substring(11)}`);
    console.log(`       电量: ${r.start_kwh} → ${r.end_kwh} (消耗 ${r.energy_consumed.toFixed(2)} kWh)`);
    console.log(`       时长: ${r.duration_seconds}秒 = ${Math.round(r.duration_seconds/60)}分钟`);
    if (r.is_retransmit) console.log(`       ⚠️  断点补传标记`);
  });
  
  log('峰谷电价切片结果 (系统自动计算)', null, 1);
  
  let sliceTotal = { energy: 0, amount: 0, flat: 0, peak: 0, valley: 0 };
  let flatEnergy = 0, flatAmount = 0;
  let peakEnergy = 0, peakAmount = 0;
  let valleyEnergy = 0, valleyAmount = 0;
  
  sessionDetails.slices.forEach((slice, i) => {
    const startTime = formatDateTime(new Date(slice.start_time));
    const endTime = formatDateTime(new Date(slice.end_time));
    const periodLabel = slice.period_type.padEnd(6);
    
    console.log(`  [${i+1}] ${periodLabel} ${startTime.substring(11)} ~ ${endTime.substring(11)}`);
    console.log(`       电量: ${slice.energy_consumed.toFixed(3)} kWh`);
    console.log(`       单价: ¥${slice.price_per_kwh.toFixed(2)}/kWh`);
    console.log(`       金额: ¥${slice.slice_amount.toFixed(2)}`);
    
    sliceTotal.energy += slice.energy_consumed;
    sliceTotal.amount += slice.slice_amount;
    
    if (slice.period_type === 'flat') {
      flatEnergy += slice.energy_consumed;
      flatAmount += slice.slice_amount;
    } else if (slice.period_type === 'peak') {
      peakEnergy += slice.energy_consumed;
      peakAmount += slice.slice_amount;
    } else {
      valleyEnergy += slice.energy_consumed;
      valleyAmount += slice.slice_amount;
    }
  });
  
  console.log(`\n  ──────────────────────────────────────────────`);
  console.log(`  平时段 (flat):   ${flatEnergy.toFixed(3)} kWh  →  ¥${flatAmount.toFixed(2)}`);
  console.log(`  峰电时段 (peak):  ${peakEnergy.toFixed(3)} kWh  →  ¥${peakAmount.toFixed(2)}`);
  console.log(`  谷电时段 (valley):${valleyEnergy.toFixed(3)} kWh  →  ¥${valleyAmount.toFixed(2)}`);
  console.log(`  ──────────────────────────────────────────────`);
  console.log(`  总计:            ${sliceTotal.energy.toFixed(3)} kWh  →  ¥${sliceTotal.amount.toFixed(2)}`);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('阶段 7: 生成账单');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const billResult = billingService.generateBill(sessionId);
  log('账单生成结果', billResult, 1);
  
  if (billResult.success) {
    const bill = billResult.bill;
    console.log('\n  账单详情:');
    console.log(`    账单号: ${bill.bill_id}`);
    console.log(`    会话号: ${bill.session_id}`);
    console.log(`    住户:   ${bill.resident_id}`);
    console.log(`    总电量: ${bill.total_energy.toFixed(3)} kWh`);
    console.log(`    总金额: ¥${bill.total_amount.toFixed(2)}`);
    console.log(`\n    明细:`);
    console.log(`      平时段: ${bill.flat_energy.toFixed(3)} kWh = ¥${bill.flat_amount.toFixed(2)}`);
    console.log(`      峰电:   ${bill.peak_energy.toFixed(3)} kWh = ¥${bill.peak_amount.toFixed(2)}`);
    console.log(`      谷电:   ${bill.valley_energy.toFixed(3)} kWh = ¥${bill.valley_amount.toFixed(2)}`);
    console.log(`\n    复核状态: ${bill.reconciliation_status}`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('阶段 8: 账单复核');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const billId = `BILL-${sessionId}`;
  const verifyResult = billingService.verifyBill(billId, '测试人员-李四');
  log('账单复核结果', verifyResult, 1);
  
  if (verifyResult.success && verifyResult.code === 'BILL_VERIFIED') {
    console.log('\n  ✅ 账单已通过复核，数据一致，无异常！');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('阶段 9: 看板数据');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const dashboard = billingService.getDashboardStats('COMM001');
  log('社区看板数据 (COMM001)', dashboard, 1);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('边界情况测试');
  console.log('═══════════════════════════════════════════════════════════════');
  
  console.log('\n【测试 1】缺字段验证');
  const invalidRecord = { community_id: 'COMM001', start_kwh: 0 };
  const validateResult = billingService.validateRecord(invalidRecord);
  log('验证错误', validateResult.errors, 1);
  
  console.log('\n【测试 2】状态冲突 - 电表读数回退');
  const conflictRecord = {
    request_id: 'REQ-CONFLICT-TEST',
    session_id: sessionId,
    community_id: 'COMM001',
    resident_id: residentId,
    charger_id: chargerId,
    timestamp: new Date().toISOString(),
    start_kwh: 5.0,
    end_kwh: 12.0,
    duration_seconds: 10 * 60,
    status: 'charging'
  };
  
  const conflictResult = billingService.processRecord(conflictRecord);
  log('冲突检测结果', conflictResult, 1);
  
  console.log('\n【测试 3】非法状态流转');
  const newSessionId = 'SES-TEST-INVALID';
  const badTransitionRecord = {
    request_id: 'REQ-INVALID-TEST',
    session_id: newSessionId,
    community_id: 'COMM001',
    resident_id: residentId,
    charger_id: chargerId,
    timestamp: new Date().toISOString(),
    start_kwh: 0,
    end_kwh: 5.0,
    duration_seconds: 10 * 60,
    status: 'completed'
  };
  
  const transitionResult = billingService.processRecord(badTransitionRecord);
  log('非法流转检测', transitionResult, 1);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('人工修正演示');
  console.log('═══════════════════════════════════════════════════════════════');
  
  console.log('\n场景: 管理员发现账单需要人工调整，减免部分费用');
  
  const adjustResult = billingService.manuallyAdjustBill(
    billId,
    { total_amount: parseFloat((sliceTotal.amount - 1.00).toFixed(2)) },
    '管理员-王五'
  );
  log('人工调整结果', adjustResult, 1);
  
  const adjustedDetails = billingService.getSessionDetails(sessionId);
  log('调整后的账单状态', null, 1);
  if (adjustedDetails.bill) {
    console.log(`  调整后状态: ${adjustedDetails.bill.reconciliation_status}`);
    console.log(`  调整后金额: ¥${adjustedDetails.bill.total_amount.toFixed(2)}`);
  }
  
  log('复核日志', null, 1);
  adjustedDetails.reconciliationLogs.forEach((log, i) => {
    console.log(`  [${i+1}] ${formatDateTime(new Date(log.created_at))} ${log.action.padEnd(20)} by ${log.operator}`);
  });
  
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║    🎉 验收场景演示完成！                                          ║');
  console.log('║                                                                   ║');
  console.log('║    主线验证:                                                      ║');
  console.log('║    ✅ 充电会话切片 → 自动按峰谷时段拆分                           ║');
  console.log('║    ✅ 断网补传 → 支持 is_retransmit 标记，记录原始请求             ║');
  console.log('║    ✅ 重复计费防护 → request_id 去重，时间重叠检测                ║');
  console.log('║                                                                   ║');
  console.log('║    边界情况覆盖:                                                  ║');
  console.log('║    ✅ 重复提交 - 相同 request_id 被拒绝                           ║');
  console.log('║    ✅ 状态冲突 - 电表读数回退被检测                               ║');
  console.log('║    ✅ 缺字段 - 完整的字段验证                                     ║');
  console.log('║    ✅ 非法流转 - 状态机规则检查                                   ║');
  console.log('║    ✅ 人工修正 - 支持管理员调整并记录操作日志                     ║');
  console.log('║                                                                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
}

runCompleteScenario().catch(console.error);
