const APIClient = require('./apiClient');
const moment = require('moment');

const client = new APIClient();

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runReviewScenario() {
  console.log('='.repeat(70));
  console.log('复核样例：含中断事件、异常读数、需人工复核的流程');
  console.log('='.repeat(70));
  console.log('');

  try {
    console.log('【步骤 1】创建船舶信息');
    const shipResponse = await client.post('/api/ships', {
      name: '远航一号',
      imoNumber: 'IMO9700002',
      flag: '新加坡',
      grossTonnage: 75000,
      operator: '远洋物流',
      vesselType: '散货船'
    });
    const shipId = shipResponse.data.id;
    console.log(`✓ 船舶创建成功: ${shipResponse.data.name}`);
    console.log(`  船舶 ID: ${shipId}`);
    console.log('');

    console.log('【步骤 2】创建合同（峰谷电价）');
    const contractResponse = await client.post('/api/contracts', {
      shipId: shipId,
      contractType: 'PEAK_OFFPEAK',
      electricityPrice: 1.0,
      peakPrice: 1.5,
      offPeakPrice: 0.8,
      peakHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      currency: 'CNY',
      startDate: moment().subtract(1, 'day').format('YYYY-MM-DD'),
      endDate: moment().add(30, 'days').format('YYYY-MM-DD'),
      contractNumber: 'CT-2026-002'
    });
    const contractId = contractResponse.data.id;
    console.log(`✓ 合同创建成功（峰谷电价）`);
    console.log(`  合同编号: ${contractResponse.data.contractNumber}`);
    console.log(`  平时电价: ${contractResponse.data.electricityPrice} 元/度`);
    console.log(`  峰时电价: ${contractResponse.data.peakPrice} 元/度`);
    console.log(`  谷时电价: ${contractResponse.data.offPeakPrice} 元/度`);
    console.log(`  峰时时段: ${contractResponse.data.peakHours.join(', ')}`);
    console.log('');

    console.log('【步骤 3】创建靠泊计划');
    const berthingResponse = await client.post('/api/berthings', {
      shipId: shipId,
      terminal: 'T2 散货码头',
      berthNumber: 'B-08',
      voyageNumber: 'VY-2026-0512',
      cargoType: '煤炭'
    });
    const berthingId = berthingResponse.data.id;
    console.log(`✓ 靠泊计划创建成功`);
    console.log(`  靠泊 ID: ${berthingId}`);
    console.log(`  泊位: ${berthingResponse.data.terminal} - ${berthingResponse.data.berthNumber}`);
    console.log('');

    await delay(100);
    console.log('【步骤 4】船舶靠泊');
    await client.post(`/api/berthings/${berthingId}/dock`);
    console.log(`✓ 船舶已靠泊`);
    console.log('');

    await delay(100);
    console.log('【步骤 5】连接岸电');
    await client.post(`/api/berthings/${berthingId}/connect-power`);
    console.log(`✓ 岸电已连接`);
    console.log('');

    await delay(100);
    console.log('【步骤 6】开始使用岸电');
    await client.post(`/api/berthings/${berthingId}/start-usage`);
    console.log(`✓ 开始使用岸电`);
    console.log('');

    console.log('【步骤 7】记录初始读数');
    const firstTime = moment().subtract(12, 'hours').toISOString();
    const firstReadingResponse = await client.post('/api/meter-readings', {
      berthingId: berthingId,
      kwh: 2000,
      readingTime: firstTime,
      meterId: 'METER-002',
      source: 'AUTOMATIC'
    });
    console.log(`✓ 初始读数: ${firstReadingResponse.data.kwh} kWh`);
    console.log('');

    await delay(100);
    console.log('【步骤 8】发生设备故障，记录中断事件');
    const interruptionStartTime = moment().subtract(10, 'hours').toISOString();
    const interruptionResponse = await client.post('/api/interruptions', {
      berthingId: berthingId,
      startTime: interruptionStartTime,
      type: 'EQUIPMENT_FAILURE',
      reason: '岸电转换设备故障',
      responsibleParty: 'TERMINAL',
      notes: '设备需要紧急维修'
    });
    const interruptionId = interruptionResponse.data.id;
    console.log(`✓ 中断事件记录成功`);
    console.log(`  中断 ID: ${interruptionId}`);
    console.log(`  类型: ${interruptionResponse.data.type}`);
    console.log(`  原因: ${interruptionResponse.data.reason}`);
    console.log(`  开始时间: ${interruptionResponse.data.startTime}`);
    console.log('');

    await delay(100);
    console.log('【步骤 9】尝试在中断期间记录读数（预期会失败）');
    try {
      await client.post('/api/meter-readings', {
        berthingId: berthingId,
        kwh: 2050,
        readingTime: moment().subtract(9, 'hours').toISOString(),
        meterId: 'METER-002'
      });
      console.log(`⚠️  意外：读数记录成功（本应失败）`);
    } catch (error) {
      console.log(`✓ 预期拦截成功`);
      console.log(`  错误码: ${error.response.error.code}`);
      console.log(`  错误信息: ${error.response.error.message}`);
      console.log(`  原因：中断期间系统不允许记录读数`);
    }
    console.log('');

    await delay(100);
    console.log('【步骤 10】解决中断事件（模拟长时间中断）');
    const interruptionEndTime = moment().subtract(1, 'hour').toISOString();
    const resolvedInterruption = await client.post(`/api/interruptions/${interruptionId}/resolve`, {
      endTime: interruptionEndTime,
      impactKwh: 150,
      notes: '设备已修复，中断时长约 9 小时'
    });
    console.log(`✓ 中断事件已解决`);
    console.log(`  结束时间: ${resolvedInterruption.data.endTime}`);
    console.log(`  持续时间: ${resolvedInterruption.data.durationHours.toFixed(2)} 小时`);
    console.log(`  影响电量: ${resolvedInterruption.data.impactKwh} kWh`);
    console.log(`  状态: ${resolvedInterruption.data.status}`);
    console.log('');

    await delay(100);
    console.log('【步骤 11】记录最终读数（正常读数）');
    const lastReadingTime = moment().toISOString();
    const lastReadingResponse = await client.post('/api/meter-readings', {
      berthingId: berthingId,
      kwh: 2800,
      readingTime: lastReadingTime,
      meterId: 'METER-002',
      source: 'MANUAL'
    });
    const totalKwh = lastReadingResponse.data.kwh - firstReadingResponse.data.kwh;
    console.log(`✓ 最终读数记录成功`);
    console.log(`  读数: ${lastReadingResponse.data.kwh} kWh`);
    console.log(`  总用电量: ${totalKwh} kWh`);
    console.log('');

    await delay(100);
    console.log('【步骤 12】完成靠泊流程');
    await client.post(`/api/berthings/${berthingId}/disconnect-power`);
    await client.post(`/api/berthings/${berthingId}/prepare-departure`);
    await client.post(`/api/berthings/${berthingId}/depart`);
    console.log(`✓ 船舶已离港`);
    console.log('');

    console.log('【步骤 13】创建结算（预期触发复核）');
    console.log('  预期复核原因：');
    console.log('    1. 中断时长超过 8 小时的预期范围');
    console.log('    2. 用电时长与靠泊时段可能存在差异');
    console.log('');
    
    const settlementResponse = await client.post(`/api/settlements/create/${berthingId}`);
    const settlementId = settlementResponse.data.id;
    console.log(`✓ 结算创建成功`);
    console.log(`  结算 ID: ${settlementId}`);
    console.log(`  总用电量: ${settlementResponse.data.totalKwh} kWh`);
    console.log(`  中断扣减: ${settlementResponse.data.interruptionInfo.totalImpactKwh} kWh`);
    console.log(`  净用电量: ${settlementResponse.data.netKwh} kWh`);
    console.log(`  总金额: ${settlementResponse.data.totalAmount} ${settlementResponse.data.currency}`);
    console.log(`  需要复核: ${settlementResponse.data.reviewRequired}`);
    console.log(`  状态: ${settlementResponse.data.status}`);
    
    if (settlementResponse.data.reviewRequired) {
      console.log(`  ⚠️  触发复核条件！复核问题列表:`);
      settlementResponse.data.reviewIssues.forEach((issue, i) => {
        console.log(`    [${i + 1}] ${issue.code}`);
        console.log(`        描述: ${issue.message}`);
        console.log(`        详情: ${JSON.stringify(issue.details)}`);
      });
    }
    
    if (settlementResponse.data.reviewWarnings && settlementResponse.data.reviewWarnings.length > 0) {
      console.log(`  ⚠️  复核警告:`);
      settlementResponse.data.reviewWarnings.forEach((warning, i) => {
        console.log(`    [${i + 1}] ${warning.message}`);
        console.log(`        详情: ${JSON.stringify(warning.details)}`);
      });
    }
    console.log('');

    console.log('【步骤 14】人工复核 - 驳回结算（模拟）');
    const rejectReason = '中断影响电量需要进一步核实，请提供维修记录和电量损失证明';
    const rejectResponse = await client.post(`/api/settlements/${settlementId}/reject`, {
      reason: rejectReason,
      reviewer: '复核专员-李四'
    });
    console.log(`✓ 结算已驳回`);
    console.log(`  驳回人: ${rejectResponse.data.reviewedBy}`);
    console.log(`  驳回时间: ${rejectResponse.data.reviewedAt}`);
    console.log(`  驳回原因: ${rejectResponse.data.reviewNotes}`);
    console.log(`  状态: ${rejectResponse.data.status}`);
    console.log('');

    console.log('【步骤 15】修正数据后重新创建结算');
    console.log('  （在实际场景中，这里会修改读数或中断信息后重新计算）');
    const newSettlementResponse = await client.post(`/api/settlements/create/${berthingId}`);
    const newSettlementId = newSettlementResponse.data.id;
    console.log(`✓ 新结算创建成功`);
    console.log(`  新结算 ID: ${newSettlementId}`);
    console.log(`  需要复核: ${newSettlementResponse.data.reviewRequired}`);
    console.log('');

    console.log('【步骤 16】批准新结算');
    const approveResponse = await client.post(`/api/settlements/${newSettlementId}/approve`, {
      reviewer: '财务主管-王五'
    });
    console.log(`✓ 结算已批准`);
    console.log(`  复核人: ${approveResponse.data.reviewedBy}`);
    console.log(`  状态: ${approveResponse.data.status}`);
    console.log('');

    console.log('【步骤 17】生成对账报表');
    const reportResponse = await client.post('/api/settlements/reconciliation', {
      settlementIds: [newSettlementId]
    });
    const reportId = reportResponse.data.id;
    console.log(`✓ 对账报表生成成功`);
    console.log(`  报表 ID: ${reportId}`);
    console.log(`  周期: ${reportResponse.data.period}`);
    console.log(`  统计:`);
    console.log(`    - 总单数: ${reportResponse.data.stats.totalCount}`);
    console.log(`    - 待处理: ${reportResponse.data.stats.pendingCount}`);
    console.log(`    - 已驳回: ${reportResponse.data.stats.rejectedCount}`);
    console.log(`    - 已批准: ${reportResponse.data.stats.approvedCount}`);
    console.log(`    - 总用电量: ${reportResponse.data.stats.totalKwh} kWh`);
    console.log(`    - 总金额: ${reportResponse.data.stats.totalAmount} ${reportResponse.data.stats.currency}`);
    console.log('');

    console.log('【步骤 18】演示错误场景 - 尝试修改已复核的结算');
    try {
      await client.post(`/api/settlements/${newSettlementId}/reject`, {
        reason: '尝试修改已批准的结算'
      });
      console.log(`⚠️  意外：操作成功（本应失败）`);
    } catch (error) {
      console.log(`✓ 预期拦截成功`);
      console.log(`  错误码: ${error.response.error.code}`);
      console.log(`  错误信息: ${error.response.error.message}`);
      console.log(`  原因：已复核的结算不允许再次修改`);
    }
    console.log('');

    console.log('='.repeat(70));
    console.log('复核样例流程完成！');
    console.log('='.repeat(70));
    console.log('');
    console.log('关键数据汇总:');
    console.log(`  船舶 ID: ${shipId}`);
    console.log(`  靠泊 ID: ${berthingId}`);
    console.log(`  中断事件 ID: ${interruptionId}`);
    console.log(`  初始结算 ID（被驳回）: ${settlementId}`);
    console.log(`  最终结算 ID: ${newSettlementId}`);
    console.log(`  对账报表 ID: ${reportId}`);
    console.log('');
    console.log('业务差异点说明:');
    console.log('  1. 岸电读数: 峰谷电价不同时段采用不同价格计算');
    console.log('  2. 靠泊时段: 总靠泊时间 12 小时，其中中断约 9 小时');
    console.log('  3. 中断结算: 中断影响电量 150 kWh 从总用电量中扣除');
    console.log('  4. 复核机制: 中断超时触发人工复核，第一次结算被驳回');
    console.log('');

    return {
      shipId,
      berthingId,
      contractId,
      interruptionId,
      rejectedSettlementId: settlementId,
      approvedSettlementId: newSettlementId,
      reportId
    };

  } catch (error) {
    console.error('❌ 流程执行出错:');
    if (error.response) {
      console.error('  状态码:', error.statusCode);
      console.error('  错误:', JSON.stringify(error.response, null, 2));
    } else {
      console.error('  错误:', error.message);
      console.error('  堆栈:', error.stack);
    }
    throw error;
  }
}

if (require.main === module) {
  runReviewScenario()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = runReviewScenario;
