const fs = require('fs');
const path = require('path');

function generateReport(jobs, validationResult, rerunJobs, options = {}) {
  const { outputDir = './output', format = 'both' } = options;
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  let reportContent = generateTextReport(jobs, validationResult, rerunJobs);
  
  const reportPath = path.join(outputDir, `debug-report-${timestamp}.txt`);
  fs.writeFileSync(reportPath, reportContent);

  if (rerunJobs.length > 0) {
    const rerunPath = path.join(outputDir, `rerun-queue-${timestamp}.txt`);
    const rerunContent = generateRerunQueue(rerunJobs);
    fs.writeFileSync(rerunPath, rerunContent);
  }

  return {
    reportPath,
    rerunPath: rerunJobs.length > 0 ? path.join(outputDir, `rerun-queue-${timestamp}.txt`) : null,
    summary: validationResult.summary
  };
}

function generateTextReport(jobs, validationResult, rerunJobs) {
  const lines = [];
  
  lines.push('='.repeat(60));
  lines.push('     文印店打印队列排错报告');
  lines.push('='.repeat(60));
  lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  lines.push('--- 概览统计 ---');
  lines.push(`总任务数: ${validationResult.summary.total}`);
  lines.push(`错误数: ${validationResult.summary.errors}`);
  lines.push(`警告数: ${validationResult.summary.warnings}`);
  lines.push(`提示数: ${validationResult.summary.infos}`);
  lines.push('');

  lines.push('--- 问题详情 ---');
  for (const issue of validationResult.issues) {
    const prefix = issue.severity === 'error' ? '❌' : 
                   issue.severity === 'warning' ? '⚠️' : 'ℹ️';
    lines.push(`${prefix} [${issue.type}] ${issue.message}`);
    
    if (issue.details && Array.isArray(issue.details)) {
      for (const detail of issue.details) {
        lines.push(`   - ${JSON.stringify(detail)}`);
      }
    } else if (issue.details) {
      lines.push(`   - ${JSON.stringify(issue.details)}`);
    }
    lines.push('');
  }

  if (rerunJobs.length > 0) {
    lines.push('--- 建议重跑任务 ---');
    lines.push(`共 ${rerunJobs.length} 个任务建议重跑:`);
    for (const job of rerunJobs) {
      lines.push(`  任务ID: ${job.jobId}`);
      lines.push(`  文件名: ${job.fileName}`);
      lines.push(`  原打印机: ${job.printer}`);
      lines.push(`  建议打印机: ${job.suggestedPrinter.join(', ')}`);
      lines.push('');
    }
  }

  lines.push('--- 完整任务列表 ---');
  for (const job of jobs) {
    const statusIcon = job.status === 'SUCCESS' ? '✅' :
                       job.status === 'FAILED' ? '❌' :
                       job.status === 'PENDING' ? '⏳' : '❓';
    lines.push(`${statusIcon} ${job.jobId} | ${job.fileName} | ${job.printer} | ${job.status} | 重试${job.retryCount}次`);
  }

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('  报告结束');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

function generateRerunQueue(rerunJobs) {
  const lines = [];
  lines.push('# 可复跑打印队列 - 文印店专用');
  lines.push('# 格式: 任务ID | 文件名 | 建议打印机 | 状态 | 时间戳 | 重试次数');
  lines.push('');
  
  for (const job of rerunJobs) {
    const newJobId = `RERUN-${job.jobId}`;
    const suggestedPrinter = job.suggestedPrinter[0];
    const newRetryCount = job.retryCount + 1;
    lines.push(`${newJobId} | ${job.fileName} | ${suggestedPrinter} | PENDING | ${new Date().toISOString().slice(0, 19)} | ${newRetryCount} | 自动重跑`);
  }

  return lines.join('\n');
}

function printConsoleSummary(validationResult, rerunJobs) {
  console.log('\n' + '='.repeat(50));
  console.log('📊 文印店打印队列排错 - 执行摘要');
  console.log('='.repeat(50));
  console.log(`总任务: ${validationResult.summary.total}`);
  console.log(`❌ 错误: ${validationResult.summary.errors}`);
  console.log(`⚠️  警告: ${validationResult.summary.warnings}`);
  console.log(`ℹ️  提示: ${validationResult.summary.infos}`);
  console.log(`🔄 建议重跑: ${rerunJobs.length}`);
  console.log('='.repeat(50) + '\n');
}

module.exports = {
  generateReport,
  printConsoleSummary
};
