const fs = require('fs');
const path = require('path');

const FileParserService = require('../src/services/FileParserService');
const SubsidyCalculatorService = require('../src/services/SubsidyCalculatorService');
const batchService = require('../src/services/BatchService');

async function runTest() {
  console.log('============================================');
  console.log('影院排片补贴核算系统 - 本地测试');
  console.log('============================================\n');

  try {
    const showtimesFile = path.join(__dirname, 'showtimes.csv');
    const boxOfficeFile = path.join(__dirname, 'box_office.json');
    const rulesFile = path.join(__dirname, 'contract_rules.json');

    console.log('📂 正在解析测试文件...\n');

    const showtimes = await FileParserService.parseCSV(showtimesFile, require('../src/models/Showtime'));
    console.log(`✅ 场次数据: ${showtimes.length} 条`);

    const rawBoxOffice = await FileParserService.parseJSON(boxOfficeFile);
    const BoxOffice = require('../src/models/BoxOffice');
    const boxOffices = rawBoxOffice.map(item => new BoxOffice(item));
    console.log(`✅ 票房数据: ${boxOffices.length} 条`);

    const rawRules = await FileParserService.parseJSON(rulesFile);
    const ContractRule = require('../src/models/ContractRule');
    const contractRules = rawRules.map(item => new ContractRule(item));
    console.log(`✅ 合同规则: ${contractRules.length} 条\n`);

    console.log('🔍 检查批次去重...');
    const duplicateCheck = batchService.checkDuplicate(showtimes, boxOffices, contractRules);
    if (duplicateCheck.isDuplicate) {
      console.log(`⚠️  ${duplicateCheck.message}`);
      console.log('   若要重新测试，请删除 data/batches.json 文件\n');
    } else {
      console.log('✅ 无重复批次\n');
    }

    console.log('🧮 开始核算...\n');
    const calculator = new SubsidyCalculatorService();
    const result = calculator.calculate(showtimes, boxOffices, contractRules, 'TEST_BATCH');

    console.log('============================================');
    console.log('📊 核算结果摘要');
    console.log('============================================');
    console.log(`✅ 正常项: ${result.summary.normal}`);
    console.log(`⚠️  待确认项: ${result.summary.pending}`);
    console.log(`❌ 失败项: ${result.summary.failed}`);
    console.log(`💰 总补贴金额: ¥${result.summary.totalSubsidy}`);
    console.log(`📈 总票房: ¥${result.summary.totalBoxOffice}`);
    console.log(`💸 退票扣减总额: ¥${result.summary.totalRefundDeduction}`);
    console.log('--------------------------------------------\n');

    if (result.normalItems.length > 0) {
      console.log('📗 正常项示例:');
      const normalSample = result.normalItems[0];
      console.log(JSON.stringify(normalSample, null, 2));
      console.log(`\n   📌 traceId: ${normalSample.traceId} (可用于后续追踪)`);
      console.log('');
    }

    if (result.pendingItems.length > 0) {
      console.log('📙 待确认项示例:');
      const pendingSample = result.pendingItems[0];
      console.log(`   原因: ${pendingSample.reason}`);
      console.log(`   建议: ${pendingSample.suggestion}`);
      console.log(`   📌 traceId: ${pendingSample.traceId}`);
      console.log('');
    }

    if (result.failedItems.length > 0) {
      console.log('📕 失败项示例:');
      const failedSample = result.failedItems[0];
      console.log(`   错误: ${failedSample.errors.join(', ')}`);
      console.log(`   建议: ${failedSample.suggestion}`);
      console.log(`   原始数据: ${failedSample.originalData.filmName}`);
      console.log(`   📌 traceId: ${failedSample.traceId}`);
      console.log('');
    }

    batchService.registerBatch('TEST_BATCH', showtimes, boxOffices, contractRules, result);
    batchService.saveBatchResult('TEST_BATCH', result);

    const firstNormalItem = result.normalItems[0] || result.pendingItems[0];
    if (firstNormalItem) {
      console.log('🔍 测试追踪功能 (通过 traceId):');
      const tracedItem = batchService.getTraceItem('TEST_BATCH', firstNormalItem.traceId);
      if (tracedItem) {
        console.log(`✅ 成功追踪到记录: ${tracedItem.originalData.filmName} - ${tracedItem.originalData.showDate}`);
        console.log(`   状态: ${tracedItem.status}`);
        console.log(`   补贴金额: ¥${tracedItem.calculationDetail.subsidyAmount || 0}`);
      } else {
        console.log('❌ 追踪失败');
      }
    }

    console.log('\n============================================');
    console.log('✅ 测试完成！结果已保存到 data/ 目录');
    console.log('============================================');
    console.log('\n💡 提示: 再次运行此脚本将触发去重机制，因为数据内容相同');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

runTest();
