const fs = require('fs');
const path = require('path');

class ReportGenerator {
  constructor(riskAssessment, warnings, outputDir) {
    this.riskAssessment = riskAssessment;
    this.warnings = warnings;
    this.outputDir = outputDir;
    this.date = new Date().toISOString().split('T')[0];
  }

  getRiskLevelColor(level) {
    const colors = {
      'high': { bg: '#dc3545', text: 'white', name: '高风险' },
      'medium': { bg: '#ffc107', text: 'black', name: '中风险' },
      'low': { bg: '#17a2b8', text: 'white', name: '低风险' },
      'none': { bg: '#28a745', text: 'white', name: '无风险' }
    };
    return colors[level] || colors['none'];
  }

  getLockLevelName(level) {
    const names = {
      'ACCESS_SHARE': 'ACCESS SHARE',
      'ROW_SHARE': 'ROW SHARE',
      'ROW_EXCLUSIVE': 'ROW EXCLUSIVE',
      'SHARE_UPDATE_EXCLUSIVE': 'SHARE UPDATE EXCLUSIVE',
      'SHARE': 'SHARE',
      'SHARE_ROW_EXCLUSIVE': 'SHARE ROW EXCLUSIVE',
      'EXCLUSIVE': 'EXCLUSIVE',
      'ACCESS_EXCLUSIVE': 'ACCESS EXCLUSIVE'
    };
    return names[level] || level;
  }

  formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds} 秒`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)} 分钟`;
    } else {
      return `${(seconds / 3600).toFixed(1)} 小时`;
    }
  }

  escapeCSV(value) {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  generateMarkdown() {
    const outputPath = path.join(this.outputDir, 'risk_report.md');
    
    let content = `# PostgreSQL 迁移脚本锁表风险报告

生成时间: ${new Date().toLocaleString('zh-CN')}

---

## 概要

| 风险级别 | 数量 |
|---------|------|
| 🔴 高风险 | ${this.riskAssessment.summary.highRisk} |
| 🟡 中风险 | ${this.riskAssessment.summary.mediumRisk} |
| 🔵 低风险 | ${this.riskAssessment.summary.lowRisk} |
| 🟢 无风险 | ${this.riskAssessment.summary.noRisk} |
| **总计** | **${this.riskAssessment.summary.total}** |

---

`;

    // 如果有警告，添加警告部分
    if (this.warnings && this.warnings.length > 0) {
      content += `## ⚠️ 检测到的警告

`;
      for (const warning of this.warnings) {
        content += `### ${warning.file}:${warning.line}

- **类型**: ${warning.type}
- **描述**: ${warning.message}

`;
      }
      content += `---

`;
    }

    // 添加建议部分
    if (this.riskAssessment.recommendations && this.riskAssessment.recommendations.length > 0) {
      content += `## 📋 改进建议

`;
      
      // 按优先级排序
      const priorityMap = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
      const sortedRecommendations = [...this.riskAssessment.recommendations].sort((a, b) => {
        return (priorityMap[a.priority] || 99) - (priorityMap[b.priority] || 99);
      });

      for (const rec of sortedRecommendations) {
        const color = this.getRiskLevelColor(rec.riskLevel);
        const priorityEmoji = rec.priority === 'critical' ? '🚨' : rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🔵';
        
        content += `### ${priorityEmoji} ${rec.message}

- **优先级**: ${rec.priority || 'medium'}
- **风险级别**: ${color.name}
- **文件**: ${rec.file || '未知'}
`;
        if (rec.line) {
          content += `- **行号**: ${rec.line}\n`;
        }
        if (rec.statement) {
          content += `- **语句**: \`${rec.statement.substring(0, 100)}${rec.statement.length > 100 ? '...' : ''}\`\n`;
        }
        content += `\n`;
      }
      content += `---

`;
    }

    // 按表汇总风险
    content += `## 📊 按表汇总风险

`;
    
    const tableNames = Object.keys(this.riskAssessment.tables);
    if (tableNames.length > 0) {
      content += `| 表名 | 高风险 | 中风险 | 低风险 | 无风险 | 最大锁级别 | 预计总时长 |
|------|--------|--------|--------|--------|-----------|-----------|
`;
      
      for (const tableName of tableNames) {
        const table = this.riskAssessment.tables[tableName];
        content += `| ${tableName} | ${table.riskSummary.highRisk} | ${table.riskSummary.mediumRisk} | ${table.riskSummary.lowRisk} | ${table.riskSummary.noRisk} | ${this.getLockLevelName(table.maxLockLevel)} | ${this.formatDuration(table.estimatedDuration)} |
`;
      }
      content += `
---

`;
    }

    // 详细分析每个迁移文件
    content += `## 📝 迁移文件详细分析

`;
    
    for (const migration of this.riskAssessment.migrations) {
      content += `### ${path.basename(migration.file)}

**风险概要**: 🔴 ${migration.riskSummary.highRisk} | 🟡 ${migration.riskSummary.mediumRisk} | 🔵 ${migration.riskSummary.lowRisk} | 🟢 ${migration.riskSummary.noRisk}

`;
      
      if (migration.transactions && migration.transactions.length > 0) {
        content += `#### 事务分析

`;
        for (const tx of migration.transactions) {
          const txColor = this.getRiskLevelColor(tx.riskLevel);
          content += `- **事务风险**: ${txColor.name}
`;
          if (tx.description) {
            content += `  - ${tx.description}\n`;
          }
          if (tx.hasMixedDDLandDML) {
            content += `  - ⚠️ 事务中混合了 DDL 和 DML 操作\n`;
          }
          if (tx.hasConcurrentlyInTransaction) {
            content += `  - 🚨 事务中包含 CONCURRENTLY 操作（这是错误的）\n`;
          }
          content += `  - 语句数量: ${tx.statementCount}\n\n`;
        }
      }

      content += `#### 语句分析

`;
      
      for (const assessment of migration.statements) {
        const color = this.getRiskLevelColor(assessment.riskLevel);
        const emoji = assessment.riskLevel === 'high' ? '🔴' : 
                      assessment.riskLevel === 'medium' ? '🟡' : 
                      assessment.riskLevel === 'low' ? '🔵' : '🟢';
        
        content += `##### ${emoji} 语句 ${assessment.index + 1}

\`\`\`sql
${assessment.statement.raw}
\`\`\`

- **操作类型**: ${assessment.operation || '未知'}
- **目标表**: ${assessment.table || '无'}
- **目标索引**: ${assessment.indexName || '无'}
- **风险级别**: ${color.name}
- **锁级别**: ${this.getLockLevelName(assessment.lockLevel) || '未知'}
`;
        if (assessment.riskReason) {
          content += `- **风险原因**: ${assessment.riskReason}\n`;
        }
        content += `- **预计时长**: ${this.formatDuration(assessment.estimatedDuration)}\n`;
        
        if (assessment.concurrentlyUsed) {
          content += `- ✅ 使用了 CONCURRENTLY\n`;
        }
        if (assessment.concurrentlyRecommended) {
          content += `- ⚠️ 建议使用 CONCURRENTLY\n`;
        }
        
        if (assessment.canSplit && assessment.splitSteps.length > 0) {
          content += `
**可拆分的低风险步骤**:

`;
          for (const step of assessment.splitSteps) {
            const stepColor = this.getRiskLevelColor(step.risk);
            content += `${step.step}. **${step.description}** (${stepColor.name})\n`;
            if (step.reason) {
              content += `   - ${step.reason}\n`;
            }
            if (step.sql) {
              content += `   \`\`\`sql\n   ${step.sql}\n   \`\`\`\n`;
            }
            if (step.example) {
              content += `   示例: \`${step.example}\`\n`;
            }
            content += `\n`;
          }
        }
        
        content += `\n`;
      }
      
      content += `---

`;
    }

    content += `## 附录

### PostgreSQL 锁级别说明

| 锁级别 | 级别值 | 冲突锁 | 典型使用场景 |
|--------|--------|--------|--------------|
| ACCESS SHARE | 1 | ACCESS EXCLUSIVE | SELECT |
| ROW SHARE | 2 | EXCLUSIVE, ACCESS EXCLUSIVE | SELECT FOR UPDATE/SHARE |
| ROW EXCLUSIVE | 3 | SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, ACCESS EXCLUSIVE | INSERT/UPDATE/DELETE |
| SHARE UPDATE EXCLUSIVE | 4 | SHARE UPDATE EXCLUSIVE, SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, ACCESS EXCLUSIVE | VACUUM, ANALYZE, CREATE INDEX CONCURRENTLY |
| SHARE | 5 | ROW EXCLUSIVE, SHARE UPDATE EXCLUSIVE, SHARE ROW EXCLUSIVE, EXCLUSIVE, ACCESS EXCLUSIVE | CREATE INDEX |
| SHARE ROW EXCLUSIVE | 6 | ROW EXCLUSIVE, SHARE UPDATE EXCLUSIVE, SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, ACCESS EXCLUSIVE | CREATE TRIGGER, 某些 ALTER TABLE |
| EXCLUSIVE | 7 | ROW SHARE, ROW EXCLUSIVE, SHARE UPDATE EXCLUSIVE, SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, ACCESS EXCLUSIVE | REFRESH MATERIALIZED VIEW |
| ACCESS EXCLUSIVE | 8 | 所有锁 | ALTER TABLE, DROP TABLE, TRUNCATE, REINDEX |

---

*报告由 pg-migration-risk-check 工具生成*
`;

    fs.writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
  }

  generateCSV() {
    const outputPath = path.join(this.outputDir, 'table_risks.csv');
    
    let content = 'table_name,high_risk_count,medium_risk_count,low_risk_count,no_risk_count,max_lock_level,estimated_duration_seconds,estimated_duration_text\n';
    
    const tableNames = Object.keys(this.riskAssessment.tables);
    for (const tableName of tableNames) {
      const table = this.riskAssessment.tables[tableName];
      content += [
        this.escapeCSV(tableName),
        table.riskSummary.highRisk,
        table.riskSummary.mediumRisk,
        table.riskSummary.lowRisk,
        table.riskSummary.noRisk,
        this.escapeCSV(this.getLockLevelName(table.maxLockLevel)),
        table.estimatedDuration,
        this.escapeCSV(this.formatDuration(table.estimatedDuration))
      ].join(',') + '\n';
    }
    
    fs.writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
  }

  generateHTML() {
    const outputPath = path.join(this.outputDir, 'timeline.html');
    
    // 准备时间线数据
    const timelineItems = [];
    let currentTime = 0;
    
    for (const item of this.riskAssessment.timeline) {
      const assessment = item.assessment;
      const color = this.getRiskLevelColor(assessment.riskLevel);
      
      timelineItems.push({
        index: item.index,
        statement: item.statement.substring(0, 80) + (item.statement.length > 80 ? '...' : ''),
        fullStatement: item.statement,
        file: item.file,
        riskLevel: assessment.riskLevel,
        riskName: color.name,
        bgColor: color.bg,
        textColor: color.text,
        lockLevel: this.getLockLevelName(assessment.lockLevel),
        operation: assessment.operation,
        table: assessment.table,
        duration: assessment.estimatedDuration,
        startTime: currentTime,
        endTime: currentTime + Math.max(1, assessment.estimatedDuration),
        canSplit: assessment.canSplit,
        riskReason: assessment.riskReason || ''
      });
      
      currentTime += Math.max(1, assessment.estimatedDuration);
    }

    // 准备图表数据
    const highRiskCount = this.riskAssessment.summary.highRisk;
    const mediumRiskCount = this.riskAssessment.summary.mediumRisk;
    const lowRiskCount = this.riskAssessment.summary.lowRisk;
    const noRiskCount = this.riskAssessment.summary.noRisk;

    const content = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PostgreSQL 迁移风险时间线</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f8f9fa;
            color: #333;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        
        h1 {
            font-size: 2rem;
            margin-bottom: 10px;
        }
        
        .subtitle {
            font-size: 1rem;
            opacity: 0.9;
        }
        
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .card.high { border-left: 4px solid #dc3545; }
        .card.medium { border-left: 4px solid #ffc107; }
        .card.low { border-left: 4px solid #17a2b8; }
        .card.none { border-left: 4px solid #28a745; }
        
        .card-number {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .card.high .card-number { color: #dc3545; }
        .card.medium .card-number { color: #ffc107; }
        .card.low .card-number { color: #17a2b8; }
        .card.none .card-number { color: #28a745; }
        
        .card-label {
            font-size: 0.9rem;
            color: #666;
        }
        
        .timeline-section {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        
        .section-title {
            font-size: 1.3rem;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e9ecef;
        }
        
        .timeline-container {
            position: relative;
            overflow-x: auto;
            padding-bottom: 20px;
        }
        
        .timeline-axis {
            height: 60px;
            position: relative;
            margin-bottom: 10px;
        }
        
        .timeline-line {
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 4px;
            background: #e9ecef;
            transform: translateY(-50%);
        }
        
        .timeline-marker {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #dee2e6;
        }
        
        .timeline-marker-label {
            position: absolute;
            bottom: -20px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 0.8rem;
            color: #666;
            white-space: nowrap;
        }
        
        .timeline-items {
            position: relative;
        }
        
        .timeline-item {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 8px;
            background: #f8f9fa;
            transition: background 0.2s;
        }
        
        .timeline-item:hover {
            background: #e9ecef;
        }
        
        .timeline-item-bar {
            height: 30px;
            border-radius: 4px;
            position: relative;
            cursor: pointer;
            transition: transform 0.2s;
            min-width: 50px;
        }
        
        .timeline-item-bar:hover {
            transform: scaleY(1.1);
            z-index: 10;
        }
        
        .timeline-item-bar[data-risk="high"] { background: #dc3545; }
        .timeline-item-bar[data-risk="medium"] { background: #ffc107; }
        .timeline-item-bar[data-risk="low"] { background: #17a2b8; }
        .timeline-item-bar[data-risk="none"] { background: #28a745; }
        
        .timeline-item-bar.can-split {
            border: 2px dashed rgba(255,255,255,0.5);
        }
        
        .timeline-item-label {
            flex: 1;
            margin-left: 15px;
            min-width: 300px;
        }
        
        .timeline-item-index {
            font-weight: bold;
            margin-right: 10px;
            min-width: 30px;
        }
        
        .timeline-item-file {
            font-size: 0.8rem;
            color: #666;
        }
        
        .timeline-item-duration {
            font-size: 0.8rem;
            color: #666;
            margin-left: 10px;
            white-space: nowrap;
        }
        
        .tooltip {
            position: absolute;
            background: #333;
            color: white;
            padding: 10px 15px;
            border-radius: 6px;
            font-size: 0.9rem;
            z-index: 1000;
            max-width: 400px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
        }
        
        .tooltip.visible {
            opacity: 1;
        }
        
        .tooltip-title {
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .tooltip-detail {
            font-size: 0.85rem;
            opacity: 0.9;
        }
        
        .legend {
            display: flex;
            gap: 20px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 3px;
        }
        
        .legend-color.high { background: #dc3545; }
        .legend-color.medium { background: #ffc107; }
        .legend-color.low { background: #17a2b8; }
        .legend-color.none { background: #28a745; }
        
        .legend-label {
            font-size: 0.9rem;
        }
        
        .recommendations-section {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .recommendation-item {
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            border-left: 4px solid;
        }
        
        .recommendation-item.critical { border-left-color: #dc3545; background: #fff5f5; }
        .recommendation-item.high { border-left-color: #dc3545; background: #fff5f5; }
        .recommendation-item.medium { border-left-color: #ffc107; background: #fffbf0; }
        .recommendation-item.low { border-left-color: #17a2b8; background: #f0f9ff; }
        
        .recommendation-title {
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .recommendation-meta {
            font-size: 0.85rem;
            color: #666;
            margin-top: 5px;
        }
        
        .charts-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .chart-container {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .pie-chart {
            width: 200px;
            height: 200px;
            border-radius: 50%;
            margin: 20px auto;
            position: relative;
        }
        
        .pie-legend {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 20px;
        }
        
        .pie-legend-item {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .pie-color {
            width: 20px;
            height: 20px;
            border-radius: 3px;
        }
        
        footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>PostgreSQL 迁移脚本锁表风险时间线</h1>
            <p class="subtitle">生成时间: ${new Date().toLocaleString('zh-CN')}</p>
        </header>
        
        <div class="summary-cards">
            <div class="card high">
                <div class="card-number">${highRiskCount}</div>
                <div class="card-label">🔴 高风险操作</div>
            </div>
            <div class="card medium">
                <div class="card-number">${mediumRiskCount}</div>
                <div class="card-label">🟡 中风险操作</div>
            </div>
            <div class="card low">
                <div class="card-number">${lowRiskCount}</div>
                <div class="card-label">🔵 低风险操作</div>
            </div>
            <div class="card none">
                <div class="card-number">${noRiskCount}</div>
                <div class="card-label">🟢 无风险操作</div>
            </div>
        </div>
        
        <div class="charts-section">
            <div class="chart-container">
                <h3 class="section-title">风险分布</h3>
                <div class="pie-chart" id="pieChart"></div>
                <div class="pie-legend">
                    <div class="pie-legend-item">
                        <div class="pie-color" style="background: #dc3545;"></div>
                        <span>高风险 (${highRiskCount})</span>
                    </div>
                    <div class="pie-legend-item">
                        <div class="pie-color" style="background: #ffc107;"></div>
                        <span>中风险 (${mediumRiskCount})</span>
                    </div>
                    <div class="pie-legend-item">
                        <div class="pie-color" style="background: #17a2b8;"></div>
                        <span>低风险 (${lowRiskCount})</span>
                    </div>
                    <div class="pie-legend-item">
                        <div class="pie-color" style="background: #28a745;"></div>
                        <span>无风险 (${noRiskCount})</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="timeline-section">
            <h3 class="section-title">执行时间线</h3>
            <div class="timeline-container">
                <div class="timeline-axis">
                    <div class="timeline-line"></div>
                    <!-- 时间刻度会通过 JS 动态生成 -->
                </div>
                <div class="timeline-items" id="timelineItems">
                    <!-- 时间线项目会通过 JS 动态生成 -->
                </div>
            </div>
            <div class="legend">
                <div class="legend-item">
                    <div class="legend-color high"></div>
                    <span class="legend-label">高风险</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color medium"></div>
                    <span class="legend-label">中风险</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color low"></div>
                    <span class="legend-label">低风险</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color none"></div>
                    <span class="legend-label">无风险</span>
                </div>
            </div>
        </div>
        
        ${this.renderHTMLRecommendations()}
        
        <footer>
            <p>由 pg-migration-risk-check 工具生成 | ${new Date().toLocaleDateString('zh-CN')}</p>
        </footer>
    </div>
    
    <div class="tooltip" id="tooltip"></div>
    
    <script>
        const timelineData = ${JSON.stringify(timelineItems)};
        const totalDuration = ${currentTime};
        
        // 渲染时间线
        function renderTimeline() {
            const container = document.getElementById('timelineItems');
            const maxWidth = Math.max(800, totalDuration * 20);
            
            container.innerHTML = '';
            
            for (const item of timelineData) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'timeline-item';
                
                const startPercent = (item.startTime / Math.max(totalDuration, 1)) * 100;
                const widthPercent = Math.max(5, (item.duration / Math.max(totalDuration, 1)) * 100);
                
                itemDiv.innerHTML = \`
                    <span class="timeline-item-index">#\${item.index + 1}</span>
                    <div class="timeline-item-bar \${item.canSplit ? 'can-split' : ''}" 
                         data-risk="\${item.riskLevel}"
                         data-statement="\${item.fullStatement.replace(/"/g, '&quot;')}"
                         data-lock="\${item.lockLevel}"
                         data-table="\${item.table || '无'}"
                         data-operation="\${item.operation}"
                         data-reason="\${item.riskReason}"
                         style="width: \${widthPercent}%; margin-left: \${startPercent}%;"
                         title="\${item.fullStatement}">
                    </div>
                    <div class="timeline-item-label">
                        <div>\${item.statement}</div>
                        <div class="timeline-item-file">\${item.file}</div>
                    </div>
                    <span class="timeline-item-duration">\${item.duration}s | \${item.riskName} | \${item.lockLevel}</span>
                \`;
                
                container.appendChild(itemDiv);
            }
            
            // 添加工具提示事件
            const bars = document.querySelectorAll('.timeline-item-bar');
            const tooltip = document.getElementById('tooltip');
            
            bars.forEach(bar => {
                bar.addEventListener('mouseenter', (e) => {
                    const statement = bar.dataset.statement;
                    const lock = bar.dataset.lock;
                    const table = bar.dataset.table;
                    const operation = bar.dataset.operation;
                    const reason = bar.dataset.reason;
                    const risk = bar.dataset.risk;
                    
                    const riskNames = {
                        'high': '高风险',
                        'medium': '中风险',
                        'low': '低风险',
                        'none': '无风险'
                    };
                    
                    let tooltipContent = \`
                        <div class="tooltip-title">\${operation || '操作'}</div>
                        <div class="tooltip-detail">
                            <strong>表:</strong> \${table}<br>
                            <strong>锁级别:</strong> \${lock}<br>
                            <strong>风险级别:</strong> \${riskNames[risk] || risk}
                    \`;
                    
                    if (reason) {
                        tooltipContent += \`<br><strong>原因:</strong> \${reason}\`;
                    }
                    
                    tooltipContent += \`
                        </div>
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 0.8rem; opacity: 0.9;">
                            \${statement.substring(0, 200)}\${statement.length > 200 ? '...' : ''}
                        </div>
                    \`;
                    
                    tooltip.innerHTML = tooltipContent;
                    tooltip.classList.add('visible');
                    
                    const rect = bar.getBoundingClientRect();
                    tooltip.style.left = rect.left + 'px';
                    tooltip.style.top = (rect.top - tooltip.offsetHeight - 10) + 'px';
                });
                
                bar.addEventListener('mouseleave', () => {
                    tooltip.classList.remove('visible');
                });
            });
        }
        
        // 渲染饼图
        function renderPieChart() {
            const pieChart = document.getElementById('pieChart');
            const total = ${highRiskCount + mediumRiskCount + lowRiskCount + noRiskCount};
            
            if (total === 0) {
                pieChart.style.background = '#e9ecef';
                return;
            }
            
            const highPercent = ${highRiskCount} / total * 100;
            const mediumPercent = ${mediumRiskCount} / total * 100;
            const lowPercent = ${lowRiskCount} / total * 100;
            const nonePercent = ${noRiskCount} / total * 100;
            
            let currentAngle = 0;
            const colors = [];
            
            if (highPercent > 0) {
                colors.push(\`#dc3545 \${currentAngle}% \${currentAngle + highPercent}%\`);
                currentAngle += highPercent;
            }
            if (mediumPercent > 0) {
                colors.push(\`#ffc107 \${currentAngle}% \${currentAngle + mediumPercent}%\`);
                currentAngle += mediumPercent;
            }
            if (lowPercent > 0) {
                colors.push(\`#17a2b8 \${currentAngle}% \${currentAngle + lowPercent}%\`);
                currentAngle += lowPercent;
            }
            if (nonePercent > 0) {
                colors.push(\`#28a745 \${currentAngle}% \${currentAngle + nonePercent}%\`);
            }
            
            pieChart.style.background = 'conic-gradient(' + colors.join(', ') + ')';
        }
        
        // 初始化
        renderTimeline();
        renderPieChart();
    </script>
</body>
</html>
`;

    fs.writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
  }

  renderHTMLRecommendations() {
    if (!this.riskAssessment.recommendations || this.riskAssessment.recommendations.length === 0) {
      return '';
    }

    let content = `
        <div class="recommendations-section">
            <h3 class="section-title">改进建议</h3>
`;

    const priorityMap = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    const sortedRecommendations = [...this.riskAssessment.recommendations].sort((a, b) => {
      return (priorityMap[a.priority] || 99) - (priorityMap[b.priority] || 99);
    });

    for (const rec of sortedRecommendations) {
      const priority = rec.priority || 'medium';
      content += `
            <div class="recommendation-item ${priority}">
                <div class="recommendation-title">${rec.message}</div>
                <div class="recommendation-detail">${rec.riskLevel ? `风险级别: ${this.getRiskLevelColor(rec.riskLevel).name}` : ''}</div>
                <div class="recommendation-meta">
                    ${rec.file ? `文件: ${rec.file}` : ''}
                    ${rec.line ? ` | 行号: ${rec.line}` : ''}
                    ${rec.priority ? ` | 优先级: ${rec.priority}` : ''}
                </div>
            </div>
`;
    }

    content += `
        </div>
`;

    return content;
  }
}

module.exports = ReportGenerator;