const APIClient = require('./apiClient');
const moment = require('moment');

const client = new APIClient();

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSuccessfulScenario() {
  console.log('='.repeat(70));
  console.log('顺利样例：正常靠泊、使用岸电、结算流程');
  console.log('='.repeat(70));
  console.log('');

  try {
    console.log('【步骤 1】创建船舶信息');
    const shipResponse = await client.post('/api/ships', {
      name: '海洋之星号',
      imoNumber: 'IMO9700001',
      flag: '巴拿马',
      grossTonnage: 50000,
      operator: '环球航运',
      vesselType: '集装箱船'
    });
    const shipId = shipResponse.data.id;
    console.log(`✓ 船舶创建成功: ${shipResponse.data.name}`);
    console.log(`  船舶 ID: ${shipId}`);
    console.log('');

    console.log('【步骤 2】创建合同');
    const contractResponse = await client.post('/api/contracts', {
      shipId: shipId,
      contractType: 'FLAT_RATE',
      electricityPrice: 1.2,
      currency: 'CNY',
      startDate: moment().subtract(1, 'day').format('YYYY-MM-DD'),
      endDate: moment().add(30, 'days').format('YYYY-MM-DD'),
      minimumCharge: 100,
      contractNumber: 'CT-2026-001',
      termsAndConditions: '标准岸电服务条款'
    });
    const contractId = contractResponse.data.id;
    console.log(`✓ 合同创建成功`);
    console.log(`  合同编号: ${contractResponse.data.contractNumber}`);
    console.log(`  电价: ${contractResponse.data.electricityPrice} 元/度`);
    console.log('');

    console.log('【步骤 3】创建靠泊计划');
    const berthingResponse = await client.post('/api/berthings', {
      shipId: shipId,
      terminal: 'T1 集装箱码头',
      berthNumber: 'B-12',
      voyageNumber: 'VY-2026-0511',
      cargoType: '集装箱',
      estimatedArrival: moment().toISOString()
    });
    const berthingId = berthingResponse.data.id;
    console.log(`✓ 靠泊计划创建成功`);
    console.log(`  靠泊 ID: ${berthingId}`);
    console.log(`  泊位: ${berthingResponse.data.terminal} - ${berthingResponse.data.berthNumber}`);
    console.log(`  当前状态: ${berthingResponse.data.status}`);
    console.log('');

    await delay(100);
    console.log('【步骤 4】船舶靠泊');
    const dockedResponse = await client.post(`/api/berthings/${berthingId}/dock`);
    console.log(`✓ 船舶已靠泊`);
    console.log(`  实际靠泊时间: ${dockedResponse.data.actualArrival}`);
    console.log(`  当前状态: ${dockedResponse.data.status}`);
    console.log('');

    await delay(100);
    console.log('【步骤 5】连接岸电');
    const connectedResponse = await client.post(`/api/berthings/${berthingId}/connect-power`);
    console.log(`✓ 岸电已连接`);
    console.log(`  连接时间: ${connectedResponse.data.powerConnectedAt}`);
    console.log(`  当前状态: ${connectedResponse.data.status}`);
    console.log('');

    await delay(100);
    console.log('【步骤 6】开始使用岸电');
    const startUsageResponse = await client.post(`/api/berthings/${berthingId}/start-usage`);
    console.log(`✓ 开始使用岸电`);
    console.log(`  开始时间: ${startUsageResponse.data.powerUsageStartedAt}`);
    console.log(`  当前状态: ${startUsageResponse.data.status}`);
    console.log('');

    console.log('【步骤 7】记录岸电读数（初始读数）');
    const startTime = moment().subtract(4, 'hours').toISOString();
    const firstReadingResponse = await client.post('/api/meter-readings', {
      berthingId: berthingId,
      kwh: 1000,
      readingTime: startTime,
      meterId: 'METER-001',
      source: 'AUTOMATIC'
    });
    console.log(`✓ 初始读数记录成功`);
    console.log(`  读数: ${firstReadingResponse.data.kwh} kWh`);
    console.log(`  时间: ${firstReadingResponse.data.readingTime}`);
    console.log('');

    await delay(100);
    console.log('【步骤 8】记录岸电读数（中间读数）');
    const middleTime = moment().subtract(2, 'hours').toISOString();
    const middleReadingResponse = await client.post('/api/meter-readings', {
      berthingId: berthingId,
      kwh: 1250,
      readingTime: middleTime,
      meterId: 'METER-001',
      source: 'AUTOMATIC'
    });
    console.log(`✓ 中间读数记录成功`);
    console.log(`  读数: ${middleReadingResponse.data.kwh} kWh`);
    console.log(`  时间: ${middleReadingResponse.data.readingTime}`);
    console.log(`  用电量: ${middleReadingResponse.data.kwh - firstReadingResponse.data.kwh} kWh`);
    console.log('');

    await delay(100);
    console.log('【步骤 9】记录岸电读数（最终读数）');
    const endTime = moment().toISOString();
    const lastReadingResponse = await client.post('/api/meter-readings', {
      berthingId: berthingId,
      kwh: 1500,
      readingTime: endTime,
      meterId: 'METER-001',
      source: 'AUTOMATIC'
    });
    console.log(`✓ 最终读数记录成功`);
    console.log(`  读数: ${lastReadingResponse.data.kwh} kWh`);
    console.log(`  时间: ${lastReadingResponse.data.readingTime}`);
    console.log(`  总用电量: ${lastReadingResponse.data.kwh - firstReadingResponse.data.kwh} kWh`);
    console.log('');

    await delay(100);
    console.log('【步骤 10】断开岸电');
    const disconnectResponse = await client.post(`/api/berthings/${berthingId}/disconnect-power`);
    console.log(`✓ 岸电已断开`);
    console.log(`  断开时间: ${disconnectResponse.data.powerDisconnectedAt}`);
    console.log(`  当前状态: ${disconnectResponse.data.status}`);
    console.log('');

    await delay(100);
    console.log('【步骤 11】准备离港');
    const prepareResponse = await client.post(`/api/berthings/${berthingId}/prepare-departure`);
    console.log(`✓ 准备离港`);
    console.log(`  当前状态: ${prepareResponse.data.status}`);
    console.log('');

    await delay(100);
    console.log('【步骤 12】船舶离港');
    const departResponse = await client.post(`/api/berthings/${berthingId}/depart`);
    console.log(`✓ 船舶已离港`);
    console.log(`  离港时间: ${departResponse.data.actualDeparture}`);
    console.log(`  当前状态: ${departResponse.data.status}`);
    console.log('');

    console.log('【步骤 13】创建结算');
    const settlementResponse = await client.post(`/api/settlements/create/${berthingId}`);
    const settlementId = settlementResponse.data.id;
    console.log(`✓ 结算创建成功`);
    console.log(`  结算 ID: ${settlementId}`);
    console.log(`  总用电量: ${settlementResponse.data.totalKwh} kWh`);
    console.log(`  净用电量: ${settlementResponse.data.netKwh} kWh`);
    console.log(`  总金额: ${settlementResponse.data.totalAmount} ${settlementResponse.data.currency}`);
    console.log(`  需要复核: ${settlementResponse.data.reviewRequired}`);
    console.log(`  状态: ${settlementResponse.data.status}`);
    
    if (settlementResponse.data.reviewIssues && settlementResponse.data.reviewIssues.length > 0) {
      console.log(`  复核问题:`);
      settlementResponse.data.reviewIssues.forEach((issue, i) => {
        console.log(`    [${i + 1}] ${issue.code}: ${issue.message}`);
      });
    }
    console.log('');

    console.log('【步骤 14】批准结算');
    const approveResponse = await client.post(`/api/settlements/${settlementId}/approve`, {
      reviewer: '财务-张三'
    });
    console.log(`✓ 结算已批准`);
    console.log(`  复核人: ${approveResponse.data.reviewedBy}`);
    console.log(`  复核时间: ${approveResponse.data.reviewedAt}`);
    console.log(`  状态: ${approveResponse.data.status}`);
    console.log('');

    console.log('【步骤 15】标记为已支付');
    const paidResponse = await client.post(`/api/settlements/${settlementId}/pay`, {
      paymentReference: 'PAY-2026-0511-001'
    });
    console.log(`✓ 已标记为支付`);
    console.log(`  支付参考: ${paidResponse.data.paymentReference}`);
    console.log(`  支付时间: ${paidResponse.data.paidAt}`);
    console.log(`  状态: ${paidResponse.data.status}`);
    console.log('');

    console.log('【步骤 16】生成对账报表');
    const reportResponse = await client.post('/api/settlements/reconciliation', {
      settlementIds: [settlementId]
    });
    const reportId = reportResponse.data.id;
    console.log(`✓ 对账报表生成成功`);
    console.log(`  报表 ID: ${reportId}`);
    console.log(`  周期: ${reportResponse.data.period}`);
    console.log(`  统计:`);
    console.log(`    - 总单数: ${reportResponse.data.stats.totalCount}`);
    console.log(`    - 已批准: ${reportResponse.data.stats.approvedCount}`);
    console.log(`    - 已支付: ${reportResponse.data.stats.paidCount}`);
    console.log(`    - 总用电量: ${reportResponse.data.stats.totalKwh} kWh`);
    console.log(`    - 总金额: ${reportResponse.data.stats.totalAmount} ${reportResponse.data.stats.currency}`);
    console.log(`    - 已收金额: ${reportResponse.data.stats.paidAmount} ${reportResponse.data.stats.currency}`);
    console.log('');

    console.log('='.repeat(70));
    console.log('顺利样例流程完成！');
    console.log('='.repeat(70));
    console.log('');
    console.log('关键数据汇总:');
    console.log(`  船舶 ID: ${shipId}`);
    console.log(`  靠泊 ID: ${berthingId}`);
    console.log(`  结算 ID: ${settlementId}`);
    console.log(`  对账报表 ID: ${reportId}`);
    console.log(`  总用电量: ${settlementResponse.data.totalKwh} kWh`);
    console.log(`  总金额: ${settlementResponse.data.totalAmount} 元`);
    console.log('');

    return {
      shipId,
      berthingId,
      contractId,
      settlementId,
      reportId
    };

  } catch (error) {
    console.error('❌ 流程执行出错:');
    if (error.response) {
      console.error('  状态码:', error.statusCode);
      console.error('  错误:', JSON.stringify(error.response, null, 2));
    } else {
      console.error('  错误:', error.message);
    }
    throw error;
  }
}

if (require.main === module) {
  runSuccessfulScenario()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = runSuccessfulScenario;
