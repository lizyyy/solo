const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const importService = require('../services/importService');
const settlementService = require('../services/settlementService');
const batchDao = require('../dao/batchDao');
const itemDao = require('../dao/itemDao');
const logDao = require('../dao/logDao');

const SETTLEMENT_MONTH = '2026-04';

console.log('='.repeat(60));
console.log('  画廊寄售结算表 - 样例数据处理测试');
console.log('='.repeat(60));
console.log('');

function printSection(title) {
  console.log('');
  console.log('─'.repeat(60));
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

function printItemResult(item, issues, validationResult) {
  console.log(`\n【${item._case || item.artwork_no}】`);
  console.log(`  作品: ${item.artwork_no} | 艺术家: ${item.artist_code} ${item.artist_name}`);
  console.log(`  展期: ${item.exhibition_start_date} ~ ${item.exhibition_end_date}`);
  console.log(`  价格: 标价¥${item.listed_price} → 成交价¥${item.transaction_price}`);
  console.log(`  折扣: ${(item.discount_rate * 100).toFixed(1)}% | 佣金: ${(item.commission_rate * 100).toFixed(1)}%`);
  
  if (issues && issues.length > 0) {
    console.log(`  问题:`);
    for (const issue of issues) {
      const severityMap = { critical: '严重', warning: '警告', info: '提示' };
      console.log(`    [${severityMap[issue.severity]}] ${issue.message}`);
    }
  }
}

async function runTest() {
  try {
    printSection('步骤1: 导入样例数据');
    
    const samplePath = path.join(__dirname, '..', 'samples', 'sample_data.json');
    const sampleData = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    
    console.log(`共 ${sampleData.length} 条样例数据`);

    const importResult = importService.importFromJSON(
      sampleData,
      SETTLEMENT_MONTH,
      'samples/sample_data.json',
      '测试样例 - 包含正常、临界、脏数据混合'
    );
    
    console.log(`✓ 导入成功，批次号: ${importResult.batch_no}`);
    console.log(`  批次ID: ${importResult.batch_id}`);
    const batchId = importResult.batch_id;

    printSection('步骤2: 校验所有记录原始数据概览');
    
    const items = itemDao.getItemsByBatch(batchId);
    console.log(`共 ${items.length} 条记录`);
    
    sampleData.forEach((raw, idx) => {
      const item = items[idx];
      console.log(`\n${idx + 1}. 【${raw._case}】`);
      console.log(`   作品: ${raw.artwork_no} | 艺术家: ${raw.artist_code}`);
      console.log(`   原始数据已保存，line_no=${item.line_no}`);
    });

    printSection('步骤3: 执行校验与问题检测');
    
    const validationResult = settlementService.processBatch(batchId);
    
    console.log(`✓ 校验完成，共处理 ${validationResult.totalItems} 条记录`);

    const itemsWithDetail = itemDao.getItemsByBatch(batchId);
    
    let criticalCount = 0, warningCount = 0, infoCount = 0;

    for (let i = 0; i < sampleData.length; i++) {
      const raw = sampleData[i];
      const item = itemsWithDetail[i];
      const result = validationResult.validationResults[i];

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`处理顺序 ${i + 1}: 【${raw._case}】`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`作品: ${raw.artwork_no}`);
      console.log(`处理序号: ${result.processing_order || i + 1}`);
      console.log(`校验结果: ${result.validationPassed ? '✓ 通过' : '✗ 未通过'}`);
      console.log(`是否有问题: ${result.hasIssues ? '是' : '否'}`);
      
      if (result.highestSeverity) console.log(`最高问题级别: ${result.highestSeverity}`);

      if (result.issues.length > 0) {
        console.log(`\n问题列表 (${result.issues.length}个):`);
        for (const issue of result.issues) {
          const severityMap = { critical: '🔴 严重', warning: '🟡 警告', info: '🔵 提示' };
          console.log(`  ${severityMap[issue.severity]} ${issue.rule}: ${issue.message}`);
          
          if (issue.severity === 'critical') criticalCount++;
          else if (issue.severity === 'warning') warningCount++;
          else infoCount++;
        }
      }

      console.log(`\n计算结果:`);
      console.log(`  展期天数: ${result.durationDays || '无法计算'}天`);
      console.log(`  是否跨月: ${result.crossMonth ? '是' : '否'}`);
      console.log(`  实际折扣: ${(result.effectiveDiscount * 100).toFixed(1)}%`);
      console.log(`  系统佣金率: ${(result.expectedCommissionRate * 100).toFixed(1)}%`);
      console.log(`  艺术家等级: ${result.artistInfo ? result.artistInfo.artist_level : '未找到'}`);
    }

    printSection('步骤4: 问题统计');
    console.log(`严重问题: ${criticalCount} 个`);
    console.log(`警告问题: ${warningCount} 个`);
    console.log(`提示问题: ${infoCount} 个`);
    console.log(`总计问题总数: ${criticalCount + warningCount + infoCount} 个`);

    printSection('步骤5: 佣金试算');
    
    const trialResult = settlementService.trialCalculate(batchId);
    
    console.log(`✓ 试算完成`);
    console.log(`\n试算结果汇总:`);
    console.log(`  总记录数: ${trialResult.stats.total}`);
    console.log(`  待审核: ${trialResult.stats.pending_review}`);
    console.log(`  严重问题: ${trialResult.stats.critical_count}`);
    console.log(`  警告: ${trialResult.stats.warning_count}`);
    console.log(`  佣金总额: ¥${trialResult.stats.total_commission.toFixed(2)}`);
    console.log(`  艺术家总额: ¥${trialResult.stats.total_artist_amount.toFixed(2)}`);

    console.log(`\n逐条明细:`);
    for (const calcItem of trialResult.items) {
      const hasIssues = calcItem.has_issues === 1;
      const statusMap = { critical: '🔴', warning: '🟡', info: '🔵' };
      const statusIcon = calcItem.highest_severity ? statusMap[calcItem.highest_severity] : '✓';
      
      console.log(`${statusIcon} ${calcItem.artwork_no}: 佣金¥${calcItem.commission_amount.toFixed(2)} | 艺术家¥${calcItem.artist_amount.toFixed(2)}`);
      if (hasIssues) console.log(`   问题级别: ${calcItem.highest_severity}`);
    }

    printSection('步骤6: 单条数据追溯示例');
    
    const firstItem = itemsWithDetail[0];
    const trace = settlementService.getItemTrace(firstItem.id);
    
    console.log(`追溯作品: ${trace.item.artwork_no}`);
    console.log(`当前状态: ${trace.item.status_text}`);
    console.log(`\n原始数据:`);
    console.log(JSON.stringify(trace.original_data, null, 2).split('\n').map(l => '  ' + l).join('\n'));
    
    console.log(`\n处理轨迹 (${trace.processing_trace.length} 条记录):`);
    for (const log of trace.processing_trace) {
      const typeIcon = log.is_original ? '📄' : '⚙️';
      const sevMap = { critical: '🔴', warning: '🟡', info: '🔵' };
      console.log(`\n${typeIcon} [${log.step}] ${sevMap[log.severity]} ${log.message}`);
      console.log(`   时间: ${log.created_at}`);
      console.log(`   类型: ${log.is_original ? '原始数据' : '处理结果'}`);
      if (log.rule_code) console.log(`   规则: ${log.rule_code}`);
      if (log.raw_value) console.log(`   值: ${log.raw_value}`);
    }

    printSection('步骤7: 导出结算表');
    
    const exportResult = settlementService.exportSettlement(batchId);
    
    console.log(`✓ 导出完成`);
    console.log(`文件名: ${exportResult.file_name}`);
    console.log(`记录数: ${exportResult.record_count}`);
    console.log(`佣金总计: ¥${exportResult.total_commission.toFixed(2)}`);
    console.log(`艺术家总计: ¥${exportResult.total_artist_amount.toFixed(2)}`);

    printSection('处理日志统计');
    
    const allLogs = logDao.getLogsByBatch(batchId);
    
    console.log(`总日志数: ${allLogs.length}`);
    console.log(`原始数据记录: ${allLogs.filter(l => l.is_original).length} 条`);
    console.log(`处理结果记录: ${allLogs.filter(l => l.is_processed).length} 条`);
    
    const logsByItem = new Map();
    for (const log of allLogs) {
      if (!logsByItem.has(log.item_id)) logsByItem.set(log.item_id, []);
      logsByItem.get(log.item_id).push(log);
    }
    console.log(`\n每条记录平均日志数: ${(allLogs.length / itemsWithDetail.length).toFixed(1)} 条`);

    printSection('测试完成');
    console.log('✓ 所有步骤执行完毕');
    console.log('');
    console.log('总结:');
    console.log(`  批次号: ${importResult.batch_no}`);
    console.log(`  数据文件: data/gallery.db`);
    console.log(`  导出文件: exports/${exportResult.file_name}`);
    console.log('');
    console.log('启动服务后可访问: http://localhost:3000');
    console.log('查看完整的追溯界面');
    console.log('='.repeat(60));

  } catch (e) {
    console.error('❌ 测试失败:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

runTest();
