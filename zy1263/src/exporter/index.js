const fs = require('fs-extra');
const path = require('path');
const { getReport, ISSUE_TYPES, SEVERITY } = require('../analyzer');
const { getDb } = require('../database');

const ISSUE_TYPE_NAMES = {
  [ISSUE_TYPES.CROSS_SERVICE_TABLE_ACCESS]: '跨服务直接查表',
  [ISSUE_TYPES.UNCLEAR_TABLE_OWNER]: '共享表Owner不清',
  [ISSUE_TYPES.CIRCULAR_CALL]: '循环调用',
  [ISSUE_TYPES.LONG_SYNC_CHAIN]: '同步链过长',
  [ISSUE_TYPES.MISSING_DOMAIN_EVENT]: '领域事件缺失',
  [ISSUE_TYPES.OVERLAPPING_RESPONSIBILITY]: '职责重叠'
};

const SEVERITY_NAMES = {
  [SEVERITY.CRITICAL]: '严重',
  [SEVERITY.HIGH]: '高危',
  [SEVERITY.MEDIUM]: '中等',
  [SEVERITY.LOW]: '低危'
};

const SEVERITY_ICONS = {
  [SEVERITY.CRITICAL]: '🔴',
  [SEVERITY.HIGH]: '🟠',
  [SEVERITY.MEDIUM]: '🟡',
  [SEVERITY.LOW]: '🟢'
};

function getArchitectureOverview() {
  const db = getDb();
  
  const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get().count;
  const endpointCount = db.prepare('SELECT COUNT(*) as count FROM endpoints').get().count;
  const tableCount = db.prepare('SELECT COUNT(*) as count FROM database_tables').get().count;
  const eventCount = db.prepare('SELECT COUNT(*) as count FROM domain_events').get().count;
  const callEdgeCount = db.prepare('SELECT COUNT(*) as count FROM call_edges').get().count;
  
  const servicesByDomain = db.prepare(`
    SELECT domain, COUNT(*) as count 
    FROM services 
    WHERE domain IS NOT NULL 
    GROUP BY domain
  `).all();
  
  return {
    serviceCount,
    endpointCount,
    tableCount,
    eventCount,
    callEdgeCount,
    servicesByDomain
  };
}

function generateMarkdownReport(reportData, options = {}) {
  const { reportName, analysis_timestamp, summary, issues } = reportData;
  const overview = getArchitectureOverview();
  
  let markdown = `# 微服务架构评审报告\n\n`;
  
  markdown += `> 生成时间: ${new Date(analysis_timestamp).toLocaleString('zh-CN')}\n`;
  markdown += `> 报告名称: ${reportName}\n\n`;
  
  markdown += `## 📊 架构概览\n\n`;
  markdown += `| 指标 | 数量 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 服务数 | ${overview.serviceCount} |\n`;
  markdown += `| API端点 | ${overview.endpointCount} |\n`;
  markdown += `| 数据库表 | ${overview.tableCount} |\n`;
  markdown += `| 领域事件 | ${overview.eventCount} |\n`;
  markdown += `| 调用关系 | ${overview.callEdgeCount} |\n\n`;
  
  if (overview.servicesByDomain.length > 0) {
    markdown += `### 服务按领域分布\n\n`;
    markdown += `| 领域 | 服务数 |\n`;
    markdown += `|------|--------|\n`;
    for (const domain of overview.servicesByDomain) {
      markdown += `| ${domain.domain || '未分类'} | ${domain.count} |\n`;
    }
    markdown += `\n`;
  }
  
  markdown += `## ⚠️ 问题汇总\n\n`;
  markdown += `### 按严重程度统计\n\n`;
  markdown += `| 级别 | 图标 | 数量 |\n`;
  markdown += `|------|------|------|\n`;
  markdown += `| ${SEVERITY_NAMES[SEVERITY.CRITICAL]} | ${SEVERITY_ICONS[SEVERITY.CRITICAL]} | ${summary.bySeverity.CRITICAL || 0} |\n`;
  markdown += `| ${SEVERITY_NAMES[SEVERITY.HIGH]} | ${SEVERITY_ICONS[SEVERITY.HIGH]} | ${summary.bySeverity.HIGH || 0} |\n`;
  markdown += `| ${SEVERITY_NAMES[SEVERITY.MEDIUM]} | ${SEVERITY_ICONS[SEVERITY.MEDIUM]} | ${summary.bySeverity.MEDIUM || 0} |\n`;
  markdown += `| ${SEVERITY_NAMES[SEVERITY.LOW]} | ${SEVERITY_ICONS[SEVERITY.LOW]} | ${summary.bySeverity.LOW || 0} |\n`;
  markdown += `| **总计** | | **${summary.total}** |\n\n`;
  
  if (summary.byType && Object.keys(summary.byType).length > 0) {
    markdown += `### 按问题类型统计\n\n`;
    markdown += `| 问题类型 | 数量 |\n`;
    markdown += `|----------|------|\n`;
    for (const [type, count] of Object.entries(summary.byType)) {
      markdown += `| ${ISSUE_TYPE_NAMES[type] || type} | ${count} |\n`;
    }
    markdown += `\n`;
  }
  
  if (issues.length > 0) {
    markdown += `## 🔍 问题详情\n\n`;
    
    const groupedBySeverity = {
      [SEVERITY.CRITICAL]: [],
      [SEVERITY.HIGH]: [],
      [SEVERITY.MEDIUM]: [],
      [SEVERITY.LOW]: []
    };
    
    for (const issue of issues) {
      groupedBySeverity[issue.severity] = groupedBySeverity[issue.severity] || [];
      groupedBySeverity[issue.severity].push(issue);
    }
    
    const severityOrder = [SEVERITY.CRITICAL, SEVERITY.HIGH, SEVERITY.MEDIUM, SEVERITY.LOW];
    
    for (const severity of severityOrder) {
      const severityIssues = groupedBySeverity[severity];
      if (severityIssues.length === 0) continue;
      
      markdown += `### ${SEVERITY_ICONS[severity]} ${SEVERITY_NAMES[severity]} (${severityIssues.length}个)\n\n`;
      
      for (let i = 0; i < severityIssues.length; i++) {
        const issue = severityIssues[i];
        const typeName = ISSUE_TYPE_NAMES[issue.issue_type] || issue.issue_type;
        
        markdown += `#### ${i + 1}. [${typeName}] ${issue.title}\n\n`;
        markdown += `**描述**: ${issue.description}\n\n`;
        
        if (issue.affected_entities) {
          try {
            const affected = JSON.parse(issue.affected_entities);
            markdown += `**涉及实体**:\n\n`;
            markdown += `\`\`\`json\n${JSON.stringify(affected, null, 2)}\n\`\`\`\n\n`;
          } catch {
            markdown += `**涉及实体**: ${issue.affected_entities}\n\n`;
          }
        }
        
        if (issue.recommendation) {
          markdown += `**建议**: ${issue.recommendation}\n\n`;
        }
        
        markdown += `---\n\n`;
      }
    }
  }
  
  markdown += `## 📋 附录\n\n`;
  markdown += `### 检测规则说明\n\n`;
  markdown += `| 问题类型 | 检测规则 | 严重程度判定 |\n`;
  markdown += `|----------|----------|--------------|\n`;
  markdown += `| 跨服务直接查表 | 服务访问非自己拥有的表 | 3个服务访问=严重，2个=高危，1个=中等 |\n`;
  markdown += `| 共享表Owner不清 | 表无明确所有者或多服务声明拥有 | 多所有者=严重，无所有者=高危 |\n`;
  markdown += `| 循环调用 | 同步调用图中存在环 | 长度≤3=严重，≤5=高危，>5=中等 |\n`;
  markdown += `| 同步链过长 | 调用链超过阈值(默认3) | 超3步=中等，超5步=高危，超6步=严重 |\n`;
  markdown += `| 领域事件缺失 | 服务只用同步调用不发布事件 | 不发布事件=高危，不参与事件=中等 |\n`;
  markdown += `| 职责重叠 | 同领域多服务、同前缀表跨服务 | 表前缀共享=高危，同领域多服务=中等 |\n\n`;
  
  return markdown;
}

function generateJSONReport(reportData, options = {}) {
  const overview = getArchitectureOverview();
  
  return {
    reportName: reportData.reportName,
    analysisTimestamp: reportData.analysis_timestamp,
    overview: {
      serviceCount: overview.serviceCount,
      endpointCount: overview.endpointCount,
      tableCount: overview.tableCount,
      eventCount: overview.eventCount,
      callEdgeCount: overview.callEdgeCount,
      servicesByDomain: overview.servicesByDomain
    },
    summary: reportData.summary,
    issues: reportData.issues.map(issue => ({
      id: issue.id,
      type: issue.issue_type,
      typeName: ISSUE_TYPE_NAMES[issue.issue_type] || issue.issue_type,
      severity: issue.severity,
      severityName: SEVERITY_NAMES[issue.severity] || issue.severity,
      title: issue.title,
      description: issue.description,
      affectedEntities: issue.affected_entities ? JSON.parse(issue.affected_entities) : null,
      recommendation: issue.recommendation
    }))
  };
}

function exportReport(reportId, outputDir, format = 'all') {
  const reportData = getReport(reportId);
  
  if (!reportData) {
    throw new Error(`报告 ${reportId} 不存在`);
  }
  
  fs.ensureDirSync(outputDir);
  
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseName = `architecture-report-${timestamp}`;
  
  const results = [];
  
  if (format === 'all' || format === 'markdown') {
    const mdContent = generateMarkdownReport(reportData);
    const mdPath = path.join(outputDir, `${baseName}.md`);
    fs.writeFileSync(mdPath, mdContent, 'utf8');
    console.log(`✓ Markdown报告已导出: ${mdPath}`);
    results.push({ format: 'markdown', path: mdPath });
  }
  
  if (format === 'all' || format === 'json') {
    const jsonContent = generateJSONReport(reportData);
    const jsonPath = path.join(outputDir, `${baseName}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2), 'utf8');
    console.log(`✓ JSON报告已导出: ${jsonPath}`);
    results.push({ format: 'json', path: jsonPath });
  }
  
  return results;
}

function compareReports(oldReport, newReport, outputDir) {
  const oldData = typeof oldReport === 'string' ? getReport(parseInt(oldReport)) : oldReport;
  const newData = typeof newReport === 'string' ? getReport(parseInt(newReport)) : newReport;
  
  if (!oldData) {
    throw new Error('旧报告不存在');
  }
  if (!newData) {
    throw new Error('新报告不存在');
  }
  
  const comparison = {
    oldReport: {
      name: oldData.reportName,
      timestamp: oldData.analysis_timestamp,
      totalIssues: oldData.summary.total
    },
    newReport: {
      name: newData.reportName,
      timestamp: newData.analysis_timestamp,
      totalIssues: newData.summary.total
    },
    changes: {
      totalDiff: newData.summary.total - oldData.summary.total,
      bySeverity: {},
      byType: {},
      newIssues: [],
      resolvedIssues: []
    }
  };
  
  for (const severity of Object.keys(oldData.summary.bySeverity)) {
    const oldCount = oldData.summary.bySeverity[severity] || 0;
    const newCount = newData.summary.bySeverity[severity] || 0;
    comparison.changes.bySeverity[severity] = {
      old: oldCount,
      new: newCount,
      diff: newCount - oldCount
    };
  }
  
  const allTypes = new Set([
    ...Object.keys(oldData.summary.byType || {}),
    ...Object.keys(newData.summary.byType || {})
  ]);
  
  for (const type of allTypes) {
    const oldCount = (oldData.summary.byType || {})[type] || 0;
    const newCount = (newData.summary.byType || {})[type] || 0;
    comparison.changes.byType[type] = {
      old: oldCount,
      new: newCount,
      diff: newCount - oldCount
    };
  }
  
  const oldIssueKeys = new Set(oldData.issues.map(i => `${i.issue_type}:${i.title}`));
  const newIssueKeys = new Set(newData.issues.map(i => `${i.issue_type}:${i.title}`));
  
  for (const issue of newData.issues) {
    const key = `${issue.issue_type}:${issue.title}`;
    if (!oldIssueKeys.has(key)) {
      comparison.changes.newIssues.push({
        type: issue.issue_type,
        typeName: ISSUE_TYPE_NAMES[issue.issue_type] || issue.issue_type,
        severity: issue.severity,
        title: issue.title
      });
    }
  }
  
  for (const issue of oldData.issues) {
    const key = `${issue.issue_type}:${issue.title}`;
    if (!newIssueKeys.has(key)) {
      comparison.changes.resolvedIssues.push({
        type: issue.issue_type,
        typeName: ISSUE_TYPE_NAMES[issue.issue_type] || issue.issue_type,
        severity: issue.severity,
        title: issue.title
      });
    }
  }
  
  fs.ensureDirSync(outputDir);
  const timestamp = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(outputDir, `comparison-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(comparison, null, 2), 'utf8');
  
  console.log(`✓ 对比报告已导出: ${jsonPath}`);
  console.log(`\n📊 对比结果:`);
  console.log(`  总问题数变化: ${comparison.changes.totalDiff > 0 ? '+' : ''}${comparison.changes.totalDiff}`);
  
  if (comparison.changes.newIssues.length > 0) {
    console.log(`\n🆕 新增问题 (${comparison.changes.newIssues.length}个):`);
    for (const issue of comparison.changes.newIssues.slice(0, 5)) {
      console.log(`  - [${issue.typeName}] ${issue.title}`);
    }
    if (comparison.changes.newIssues.length > 5) {
      console.log(`  ... 还有 ${comparison.changes.newIssues.length - 5} 个`);
    }
  }
  
  if (comparison.changes.resolvedIssues.length > 0) {
    console.log(`\n✅ 已解决问题 (${comparison.changes.resolvedIssues.length}个):`);
    for (const issue of comparison.changes.resolvedIssues.slice(0, 5)) {
      console.log(`  - [${issue.typeName}] ${issue.title}`);
    }
    if (comparison.changes.resolvedIssues.length > 5) {
      console.log(`  ... 还有 ${comparison.changes.resolvedIssues.length - 5} 个`);
    }
  }
  
  return comparison;
}

module.exports = {
  generateMarkdownReport,
  generateJSONReport,
  exportReport,
  compareReports
};
