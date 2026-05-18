const fs = require('fs');
const path = require('path');

function generateSummaryReport(auditResult, outputDir) {
  const anomalyGroups = {};
  
  for (const record of auditResult.abnormalRecords) {
    for (const anomaly of record.anomalies) {
      if (!anomalyGroups[anomaly.type]) {
        anomalyGroups[anomaly.type] = {
          description: anomaly.description,
          count: 0,
          severity: anomaly.severity,
          examples: []
        };
      }
      anomalyGroups[anomaly.type].count++;
      if (anomalyGroups[anomaly.type].examples.length < 3) {
        anomalyGroups[anomaly.type].examples.push({
          bookingId: record.record.bookingId,
          customerName: record.record.customerName,
          suggestion: anomaly.suggestion
        });
      }
    }
  }
  
  const reportLines = [];
  reportLines.push('=' .repeat(60));
  reportLines.push('           舞蹈排练室计费核对异常摘要报告');
  reportLines.push('=' .repeat(60));
  reportLines.push('');
  reportLines.push(`核对时间: ${new Date().toLocaleString('zh-CN')}`);
  reportLines.push(`总记录数: ${auditResult.total}`);
  reportLines.push(`正常记录: ${auditResult.normalCount}`);
  reportLines.push(`异常记录: ${auditResult.abnormalCount}`);
  reportLines.push(`异常率: ${((auditResult.abnormalCount / auditResult.total) * 100).toFixed(2)}%`);
  reportLines.push('');
  reportLines.push('-'.repeat(60));
  reportLines.push('                    异常类型统计');
  reportLines.push('-'.repeat(60));
  reportLines.push('');
  
  const sortedTypes = Object.keys(anomalyGroups).sort((a, b) => 
    anomalyGroups[b].count - anomalyGroups[a].count
  );
  
  for (const type of sortedTypes) {
    const group = anomalyGroups[type];
    const severityLabel = group.severity === 'critical' ? '【严重】' : 
                          group.severity === 'error' ? '【错误】' : '【警告】';
    reportLines.push(`${severityLabel} ${group.description}: ${group.count} 条`);
    reportLines.push('  典型案例:');
    for (const example of group.examples) {
      reportLines.push(`    - 预约${example.bookingId}(${example.customerName})`);
    }
    if (group.examples.length > 0) {
      reportLines.push(`  修复建议示例: ${group.examples[0].suggestion}`);
    }
    reportLines.push('');
  }
  
  reportLines.push('-'.repeat(60));
  reportLines.push('                    可复跑输出说明');
  reportLines.push('-'.repeat(60));
  reportLines.push('');
  reportLines.push('本工具支持重复运行，每次运行都会:');
  reportLines.push('1. 覆盖输出目录中的文件');
  reportLines.push('2. 重新读取输入数据进行核对');
  reportLines.push('3. 生成最新的异常摘要报告');
  reportLines.push('');
  reportLines.push('建议核对流程:');
  reportLines.push('1. 首次运行发现异常');
  reportLines.push('2. 人工核实并修正原始数据');
  reportLines.push('3. 重新运行工具验证修正结果');
  reportLines.push('4. 确认所有异常已解决');
  reportLines.push('');
  reportLines.push('=' .repeat(60));
  reportLines.push('                      报告结束');
  reportLines.push('=' .repeat(60));
  
  const reportContent = reportLines.join('\n');
  const reportPath = path.join(outputDir, '异常摘要报告.txt');
  fs.writeFileSync(reportPath, reportContent, 'utf8');
  
  return {
    reportPath,
    reportContent,
    anomalyGroups
  };
}

function printConsoleReport(reportResult) {
  console.log('\n' + reportResult.reportContent);
  console.log(`\n报告已保存至: ${reportResult.reportPath}`);
}

module.exports = {
  generateSummaryReport,
  printConsoleReport
};
