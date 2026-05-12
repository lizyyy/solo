const { isInitialized, STATUS } = require('../config');
const { getAllStores } = require('../storage');
const { generateOverallReport, calculateStoreScore } = require('../services/reportService');
const { formatDate, getCurrentMonth } = require('../utils');

function reportCmd(options = {}) {
  if (!isInitialized()) {
    console.log('[错误] 系统未初始化，请先运行: inspect init');
    return false;
  }
  
  const month = options.month || getCurrentMonth();
  const report = generateOverallReport(month);
  
  console.log('\n' + '='.repeat(70));
  console.log(`巡店问题整改报告 (${report.month})`);
  console.log('='.repeat(70));
  
  const summary = report.summary;
  console.log('\n【总体概览】');
  console.log(`  本月问题总数: ${summary.total} 条`);
  console.log(`  已闭环: ${summary.closed} 条`);
  console.log(`  未闭环: ${summary.pending} 条`);
  console.log(`  逾期: ${summary.overdue} 条`);
  console.log(`  闭环率: ${summary.closureRate}%`);
  
  console.log('\n【按状态分布】');
  for (const [status, count] of Object.entries(report.byStatus)) {
    console.log(`  ${status}: ${count} 条`);
  }
  
  console.log('\n【按类别分布】');
  for (const [category, count] of Object.entries(report.byCategory)) {
    console.log(`  ${category}: ${count} 条`);
  }
  
  console.log('\n【门店评分汇总】');
  const stores = getAllStores();
  for (const store of stores) {
    const score = calculateStoreScore(store.id, month);
    console.log(`\n  门店: ${store.name} (${store.code})`);
    console.log(`    基础分: ${score.baseScore} 分`);
    console.log(`    最终得分: ${score.finalScore} 分`);
    console.log(`    问题总数: ${score.totalIssues} 条`);
    console.log(`    已闭环: ${score.closedIssues} 条`);
    console.log(`    闭环率: ${score.closureRate}`);
    
    if (score.deductions.length > 0) {
      console.log(`    扣分明细:`);
      for (const ded of score.deductions) {
        console.log(`      - [${ded.type}] ${ded.description}: -${ded.points} 分`);
      }
    }
  }
  
  console.log('\n【已闭环问题列表】');
  if (report.closedIssues.length === 0) {
    console.log('  暂无已闭环问题');
  } else {
    for (const item of report.closedIssues) {
      const issue = item.issue;
      console.log(`\n  问题ID: ${issue.id}`);
      console.log(`    门店: ${issue.storeName}`);
      console.log(`    类别: ${issue.category}`);
      console.log(`    描述: ${issue.description}`);
      if (item.deductionInfo) {
        console.log(`    扣分: ${item.deductionInfo.reason} (-${item.deductionInfo.points}分)`);
      }
    }
  }
  
  console.log('\n【未闭环问题列表】');
  if (report.pendingIssues.length === 0) {
    console.log('  暂无未闭环问题');
  } else {
    for (const item of report.pendingIssues) {
      const issue = item.issue;
      console.log(`\n  问题ID: ${issue.id}`);
      console.log(`    门店: ${issue.storeName}`);
      console.log(`    类别: ${issue.category}`);
      console.log(`    描述: ${issue.description}`);
      console.log(`    当前状态: ${issue.status}`);
      console.log(`    整改截止: ${formatDate(issue.dueDate)}`);
      console.log(`    是否逾期: ${issue.isOverdue ? '是' : '否'}`);
      if (item.deductionInfo) {
        console.log(`    扣分: ${item.deductionInfo.reason} (-${item.deductionInfo.points}分)`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(70) + '\n');
  
  const isFullyClosed = summary.total === summary.closed;
  if (isFullyClosed) {
    console.log('[业务结论] 本月所有问题已闭环，业务正常。');
  } else {
    console.log(`[业务结论] 本月还有 ${summary.pending} 个问题未闭环（其中逾期 ${summary.overdue} 个），需要继续跟进。`);
  }
  
  console.log('');
  return true;
}

module.exports = { reportCmd };
