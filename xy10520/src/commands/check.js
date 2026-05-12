const { isInitialized, STATUS } = require('../config');
const { getAllIssues, getStoreById, getInspectionById } = require('../storage');
const { checkOverdueIssues } = require('../services/reportService');
const { formatDate, formatDateTime } = require('../utils');

function checkCmd(options = {}) {
  if (!isInitialized()) {
    console.log('[错误] 系统未初始化，请先运行: inspect init');
    return false;
  }
  
  const issues = getAllIssues();
  
  console.log('\n=== 巡店问题状态检查 ===');
  console.log(`检查时间: ${formatDateTime(new Date())}`);
  console.log('');
  
  const statusCounts = {};
  for (const issue of issues) {
    statusCounts[issue.status] = (statusCounts[issue.status] || 0) + 1;
  }
  
  console.log('【状态汇总】');
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`  ${status}: ${count} 条`);
  }
  console.log(`总计: ${issues.length} 条`);
  
  const overdueList = checkOverdueIssues();
  if (overdueList.length > 0) {
    console.log('\n【逾期警告】');
    console.log('以下问题已超过整改期限但状态未更新:');
    for (const item of overdueList) {
      const issue = getAllIssues().find(i => i.id === item.issueId);
      const store = issue ? getStoreById(issue.storeId) : null;
      console.log(`  - ${item.issueId}: ${item.issueDescription}`);
      console.log(`    门店: ${store?.name || '未知'}, 截止日期: ${formatDate(item.dueDate)}, 逾期 ${item.daysOverdue} 天`);
    }
  }
  
  if (options.verbose) {
    console.log('\n【详细列表】');
    for (const issue of issues) {
      const store = getStoreById(issue.storeId);
      const inspection = getInspectionById(issue.inspectionId);
      
      console.log(`\n问题ID: ${issue.id}`);
      console.log(`  门店: ${store?.name || '未知'} (${store?.code || ''})`);
      console.log(`  类别: ${issue.category}`);
      console.log(`  描述: ${issue.description}`);
      console.log(`  状态: ${issue.status}`);
      console.log(`  巡店日期: ${inspection?.inspectionDate || '未知'}`);
      console.log(`  整改截止: ${formatDate(issue.dueDate)}`);
    }
  }
  
  console.log('');
  return true;
}

module.exports = { checkCmd };
