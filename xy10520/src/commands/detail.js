const { isInitialized } = require('../config');
const { getAllLogs, getIssueById } = require('../storage');
const { getIssueDetail } = require('../services/reportService');
const { formatDate, formatDateTime } = require('../utils');

function detailCmd(issueId, options = {}) {
  if (!isInitialized()) {
    console.log('[错误] 系统未初始化，请先运行: inspect init');
    return false;
  }
  
  if (!issueId) {
    console.log('[错误] 请指定问题ID');
    console.log('用法: inspect detail <issueId>');
    return false;
  }
  
  const detail = getIssueDetail(issueId);
  
  if (!detail) {
    console.log('[错误] 问题不存在: ' + issueId);
    return false;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('问题详情');
  console.log('='.repeat(60));
  
  const issue = detail.issue;
  console.log(`\n【基本信息】`);
  console.log(`  问题ID: ${issue.id}`);
  console.log(`  门店: ${issue.storeName} (${issue.storeCode})`);
  console.log(`  巡店督导: ${issue.inspector}`);
  console.log(`  巡店日期: ${issue.inspectionDate}`);
  console.log(`  问题类别: ${issue.category}`);
  console.log(`  严重程度: ${issue.severity}`);
  console.log(`  问题描述: ${issue.description}`);
  console.log(`  当前状态: ${issue.status}`);
  console.log(`  整改截止: ${formatDate(issue.dueDate)}`);
  console.log(`  是否逾期: ${issue.isOverdue ? '是' : '否'}`);
  console.log(`  问题照片: ${issue.photoUrls.length} 张`);
  for (const url of issue.photoUrls) {
    console.log(`    - ${url}`);
  }
  
  console.log(`\n【整改历史】`);
  if (detail.corrections.length === 0) {
    console.log(`  暂无整改记录`);
  } else {
    for (let i = 0; i < detail.corrections.length; i++) {
      const corr = detail.corrections[i];
      console.log(`  整改 #${i + 1}:`);
      console.log(`    提交人: ${corr.submittedBy}`);
      console.log(`    提交时间: ${formatDateTime(corr.submittedAt)}`);
      console.log(`    整改描述: ${corr.description || '-'}`);
      console.log(`    整改照片: ${corr.photoUrls.length} 张`);
      for (const url of corr.photoUrls) {
        console.log(`      - ${url}`);
      }
    }
  }
  
  console.log(`\n【复查历史】`);
  if (detail.reinspections.length === 0) {
    console.log(`  暂无复查记录`);
  } else {
    for (let i = 0; i < detail.reinspections.length; i++) {
      const reins = detail.reinspections[i];
      console.log(`  复查 #${i + 1}:`);
      console.log(`    复查人: ${reins.inspector}`);
      console.log(`    复查时间: ${formatDateTime(reins.reinspectedAt)}`);
      console.log(`    复查结果: ${reins.result}`);
      if (reins.result === '不通过') {
        console.log(`    扣分: ${reins.penaltyPoints} 分`);
      }
      if (reins.comment) {
        console.log(`    复查意见: ${reins.comment}`);
      }
    }
  }
  
  if (detail.deductionInfo) {
    console.log(`\n【扣分信息】`);
    console.log(`  扣分原因: ${detail.deductionInfo.reason}`);
    console.log(`  扣分数量: ${detail.deductionInfo.points} 分`);
    if (detail.deductionInfo.inspector) {
      console.log(`  扣分明细: 复查人 ${detail.deductionInfo.inspector}, 意见: ${detail.deductionInfo.comment || '无'}`);
    }
  }
  
  if (options.history) {
    console.log(`\n【审计日志】`);
    const logs = getAllLogs().filter(l => l.targetId === issueId || l.details?.includes(issueId));
    if (logs.length === 0) {
      console.log(`  暂无审计日志`);
    } else {
      for (const log of logs) {
        console.log(`\n  时间: ${formatDateTime(log.timestamp)}`);
        console.log(`  操作: ${log.action}`);
        console.log(`  操作者: ${log.operator}`);
        console.log(`  详情: ${log.details}`);
        if (log.before || log.after) {
          console.log(`  变更: 有前后差异`);
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  return true;
}

module.exports = { detailCmd };
