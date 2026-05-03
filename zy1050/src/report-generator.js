import fs from 'fs';
import path from 'path';
import logger from './utils/logger.js';

export class ReportGenerator {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.outputDir = options.outputDir || process.cwd();
  }

  generate(reportData, options = {}) {
    const formats = options.formats || ['json', 'markdown', 'html'];
    const outputs = {};

    for (const format of formats) {
      try {
        if (format === 'json') {
          outputs.json = this.generateJSON(reportData);
        } else if (format === 'markdown') {
          outputs.markdown = this.generateMarkdown(reportData);
        } else if (format === 'html') {
          outputs.html = this.generateHTML(reportData);
        }
      } catch (error) {
        logger.error(`生成 ${format} 报告失败: ${error.message}`);
      }
    }

    return outputs;
  }

  generateJSON(reportData) {
    return JSON.stringify(reportData, null, 2);
  }

  generateMarkdown(reportData) {
    const lines = [];
    const timestamp = new Date().toISOString();

    lines.push('# SQLite 迁移体检报告');
    lines.push('');
    lines.push(`> 生成时间: ${timestamp}`);
    lines.push(`> 迁移目录: ${reportData.migrationsDir || 'N/A'}`);
    lines.push('');

    const riskLevel = this.getRiskLevel(reportData);
    const riskEmoji = {
      'safe': '🟢',
      'low': '🟡',
      'medium': '🟠',
      'high': '🔴'
    }[riskLevel] || '⚪';

    lines.push('## 风险评估');
    lines.push('');
    lines.push(`**风险等级:** ${riskEmoji} ${riskLevel.toUpperCase()}`);
    lines.push('');

    if (reportData.riskSummary) {
      lines.push('| 风险类型 | 数量 |');
      lines.push('|---------|------|');
      for (const [type, count] of Object.entries(reportData.riskSummary)) {
        if (count > 0) {
          lines.push(`| ${this.formatRiskType(type)} | ${count} |`);
        }
      }
      lines.push('');
    }

    if (reportData.scanIssues && reportData.scanIssues.length > 0) {
      lines.push('## 迁移扫描问题');
      lines.push('');
      
      for (const issue of reportData.scanIssues) {
        const severityEmoji = {
          'error': '❌',
          'warning': '⚠️'
        }[issue.severity] || 'ℹ️';
        
        lines.push(`### ${severityEmoji} ${issue.type}`);
        lines.push(`**描述:** ${issue.message}`);
        if (issue.details) {
          lines.push(`**详情:** \`${JSON.stringify(issue.details)}\``);
        }
        lines.push('');
      }
    }

    lines.push('## 迁移执行结果');
    lines.push('');
    lines.push(`- **总迁移数:** ${reportData.totalMigrations || 0}`);
    lines.push(`- **成功:** ${reportData.successfulMigrations || 0}`);
    lines.push(`- **失败:** ${reportData.failedMigrations || 0}`);
    lines.push(`- **有回滚脚本:** ${reportData.withRollback || 0}`);
    lines.push('');

    if (reportData.migrationResults && reportData.migrationResults.length > 0) {
      lines.push('### 迁移明细');
      lines.push('');
      lines.push('| 版本 | 文件名 | 状态 | 执行时间 |');
      lines.push('|------|--------|------|---------|');
      
      for (const result of reportData.migrationResults) {
        const statusEmoji = result.success ? '✅' : '❌';
        const statusText = result.success ? '成功' : '失败';
        lines.push(`| v${result.version} | ${result.name} | ${statusEmoji} ${statusText} | ${result.executionTime}ms |`);
      }
      lines.push('');
    }

    if (reportData.schemaDiffs && reportData.schemaDiffs.length > 0) {
      lines.push('## Schema 变更');
      lines.push('');

      for (const diff of reportData.schemaDiffs) {
        lines.push(`### 从 v${diff.fromVersion || 0} 到 v${diff.toVersion}`);
        lines.push('');

        if (diff.diff) {
          const d = diff.diff;
          
          if (d.tables.added.length > 0) {
            lines.push('#### 新增表');
            for (const table of d.tables.added) {
              lines.push(`- \`${table.name}\``);
            }
            lines.push('');
          }

          if (d.tables.removed.length > 0) {
            lines.push('#### 删除表 (高风险)');
            for (const table of d.tables.removed) {
              lines.push(`- ⚠️ \`${table.name}\``);
            }
            lines.push('');
          }

          if (d.tables.modified.length > 0) {
            lines.push('#### 修改表');
            for (const table of d.tables.modified) {
              lines.push(`- \`${table.name}\``);
              
              const cols = table.changes.columns;
              if (cols.added.length > 0) {
                lines.push(`  - 新增字段: ${cols.added.map(c => c.name).join(', ')}`);
              }
              if (cols.removed.length > 0) {
                lines.push(`  - ⚠️ 删除字段: ${cols.removed.map(c => c.name).join(', ')}`);
              }
              if (cols.modified.length > 0) {
                for (const mod of cols.modified) {
                  lines.push(`  - 修改字段: ${mod.name}`);
                  for (const [key, change] of Object.entries(mod.changes)) {
                    lines.push(`    - ${key}: \`${change.before}\` → \`${change.after}\``);
                  }
                }
              }
            }
            lines.push('');
          }
        }
      }
    }

    if (reportData.riskyChanges && reportData.riskyChanges.length > 0) {
      lines.push('## ⚠️ 高风险变更');
      lines.push('');

      const grouped = {};
      for (const change of reportData.riskyChanges) {
        const severity = change.severity || 'unknown';
        if (!grouped[severity]) grouped[severity] = [];
        grouped[severity].push(change);
      }

      const severityOrder = ['high', 'medium', 'low'];
      for (const severity of severityOrder) {
        const changes = grouped[severity];
        if (!changes) continue;

        const severityLabel = {
          'high': '🔴 高风险',
          'medium': '🟠 中风险',
          'low': '🟡 低风险'
        }[severity];

        lines.push(`### ${severityLabel}`);
        lines.push('');

        for (const change of changes) {
          lines.push(`- **${change.type}**: ${change.message}`);
          if (change.table) {
            lines.push(`  - 表: \`${change.table}\``);
          }
          if (change.column) {
            lines.push(`  - 字段: \`${change.column}\``);
          }
          lines.push('');
        }
      }
    }

    if (reportData.rollbackTest) {
      lines.push('## 回滚测试');
      lines.push('');

      const rt = reportData.rollbackTest;
      lines.push(`- **测试状态:** ${rt.success ? '✅ 通过' : '❌ 失败'}`);
      
      if (rt.issues && rt.issues.length > 0) {
        lines.push('');
        lines.push('### 回滚问题');
        for (const issue of rt.issues) {
          lines.push(`- ${issue.message}`);
        }
      }

      if (rt.schemaMismatch) {
        lines.push('');
        lines.push('### Schema 不一致');
        lines.push('回滚后 Schema 与初始状态不一致');
      }
      lines.push('');
    }

    if (reportData.assertionResults && reportData.assertionResults.length > 0) {
      lines.push('## 断言结果');
      lines.push('');
      
      const passed = reportData.assertionResults.filter(r => r.success).length;
      const failed = reportData.assertionResults.filter(r => !r.success).length;
      
      lines.push(`- **通过:** ${passed}`);
      lines.push(`- **失败:** ${failed}`);
      lines.push('');

      if (failed > 0) {
        lines.push('### 失败断言');
        for (const result of reportData.assertionResults.filter(r => !r.success)) {
          lines.push(`- ❌ ${result.error || JSON.stringify(result.assertion)}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  generateHTML(reportData) {
    const timestamp = new Date().toISOString();
    const riskLevel = this.getRiskLevel(reportData);
    
    const riskColor = {
      'safe': 'success',
      'low': 'warning',
      'medium': 'warning',
      'high': 'danger'
    }[riskLevel] || 'secondary';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SQLite 迁移体检报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; }
    h1 { font-size: 2em; margin-bottom: 10px; color: #2c3e50; }
    h2 { font-size: 1.5em; margin: 30px 0 15px; color: #34495e; border-bottom: 2px solid #3498db; padding-bottom: 8px; }
    h3 { font-size: 1.2em; margin: 20px 0 10px; color: #555; }
    .meta { color: #7f8c8d; margin-bottom: 30px; padding: 15px; background: #f8f9fa; border-radius: 5px; }
    .risk-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 1.1em; }
    .risk-safe { background: #d4edda; color: #155724; }
    .risk-low { background: #fff3cd; color: #856404; }
    .risk-medium { background: #ffeaa7; color: #d35400; }
    .risk-high { background: #f8d7da; color: #721c24; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; }
    tr:hover { background: #f8f9fa; }
    .success { color: #27ae60; }
    .danger { color: #e74c3c; }
    .warning { color: #f39c12; }
    .info { color: #3498db; }
    .card { background: #f8f9fa; border-radius: 5px; padding: 15px; margin: 10px 0; }
    .card-title { font-weight: 600; margin-bottom: 10px; }
    .high-risk { border-left: 4px solid #e74c3c; }
    .medium-risk { border-left: 4px solid #f39c12; }
    .low-risk { border-left: 4px solid #3498db; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
    pre { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 5px; overflow-x: auto; margin: 10px 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .summary-item { text-align: center; padding: 20px; border-radius: 8px; }
    .summary-item .number { font-size: 2em; font-weight: bold; }
    .summary-item .label { font-size: 0.9em; color: #7f8c8d; margin-top: 5px; }
    .migration-item { margin: 10px 0; padding: 10px; border-radius: 5px; }
    .migration-success { background: #f0fff4; }
    .migration-failed { background: #fff5f5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📋 SQLite 迁移体检报告</h1>
    <div class="meta">
      <p><strong>生成时间:</strong> ${timestamp}</p>
      <p><strong>迁移目录:</strong> ${reportData.migrationsDir || 'N/A'}</p>
    </div>

    <h2>风险评估</h2>
    <p>
      <span class="risk-badge risk-${riskLevel}">${riskLevel.toUpperCase()}</span>
    </p>

    <div class="summary-grid">
      <div class="summary-item" style="background: #e8f5e9;">
        <div class="number success">${reportData.successfulMigrations || 0}</div>
        <div class="label">成功迁移</div>
      </div>
      <div class="summary-item" style="background: #ffebee;">
        <div class="number danger">${reportData.failedMigrations || 0}</div>
        <div class="label">失败迁移</div>
      </div>
      <div class="summary-item" style="background: #e3f2fd;">
        <div class="number info">${reportData.riskyChanges?.length || 0}</div>
        <div class="label">风险变更</div>
      </div>
      <div class="summary-item" style="background: #fff3e0;">
        <div class="number warning">${reportData.withRollback || 0}</div>
        <div class="label">有回滚脚本</div>
      </div>
    </div>

    ${this.renderHTMLRiskyChanges(reportData)}
    ${this.renderHTMLMigrationResults(reportData)}
    ${this.renderHTMLSchemaDiffs(reportData)}
    ${this.renderHTMLRollbackTest(reportData)}
    ${this.renderHTMLAssertions(reportData)}

    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #7f8c8d;">
      <p>SQLite Migration Checker - ${timestamp}</p>
    </footer>
  </div>
</body>
</html>`;
  }

  renderHTMLRiskyChanges(reportData) {
    if (!reportData.riskyChanges || reportData.riskyChanges.length === 0) {
      return '';
    }

    let html = '<h2>⚠️ 风险变更</h2>';
    
    const severityOrder = ['high', 'medium', 'low'];
    const severityLabels = {
      'high': '🔴 高风险',
      'medium': '🟠 中风险',
      'low': '🟡 低风险'
    };
    const severityClasses = {
      'high': 'high-risk',
      'medium': 'medium-risk',
      'low': 'low-risk'
    };

    const grouped = {};
    for (const change of reportData.riskyChanges) {
      const severity = change.severity || 'low';
      if (!grouped[severity]) grouped[severity] = [];
      grouped[severity].push(change);
    }

    for (const severity of severityOrder) {
      const changes = grouped[severity];
      if (!changes || changes.length === 0) continue;

      html += `<h3>${severityLabels[severity]}</h3>`;
      
      for (const change of changes) {
        html += `
          <div class="card ${severityClasses[severity]}">
            <div class="card-title"><code>${change.type}</code></div>
            <p>${change.message}</p>
            ${change.table ? `<p>表: <code>${change.table}</code></p>` : ''}
            ${change.column ? `<p>字段: <code>${change.column}</code></p>` : ''}
          </div>
        `;
      }
    }

    return html;
  }

  renderHTMLMigrationResults(reportData) {
    if (!reportData.migrationResults || reportData.migrationResults.length === 0) {
      return '';
    }

    let html = '<h2>迁移执行结果</h2>';
    html += '<table><thead><tr><th>版本</th><th>文件名</th><th>状态</th><th>执行时间</th></tr></thead><tbody>';

    for (const result of reportData.migrationResults) {
      const statusClass = result.success ? 'success' : 'danger';
      const statusIcon = result.success ? '✅' : '❌';
      const statusText = result.success ? '成功' : '失败';
      
      html += `
        <tr>
          <td>v${result.version}</td>
          <td><code>${result.name}</code></td>
          <td class="${statusClass}">${statusIcon} ${statusText}</td>
          <td>${result.executionTime}ms</td>
        </tr>
      `;
    }

    html += '</tbody></table>';
    return html;
  }

  renderHTMLSchemaDiffs(reportData) {
    if (!reportData.schemaDiffs || reportData.schemaDiffs.length === 0) {
      return '';
    }

    let html = '<h2>Schema 变更</h2>';

    for (const diff of reportData.schemaDiffs) {
      const d = diff.diff;
      if (!d) continue;

      if (d.tables.added.length === 0 && d.tables.removed.length === 0 && d.tables.modified.length === 0) {
        continue;
      }

      html += `<h3>从 v${diff.fromVersion || 0} 到 v${diff.toVersion}</h3>`;

      if (d.tables.added.length > 0) {
        html += '<div class="card"><div class="card-title">➕ 新增表</div><ul>';
        for (const table of d.tables.added) {
          html += `<li><code>${table.name}</code></li>`;
        }
        html += '</ul></div>';
      }

      if (d.tables.removed.length > 0) {
        html += '<div class="card high-risk"><div class="card-title">➖ 删除表 (高风险)</div><ul>';
        for (const table of d.tables.removed) {
          html += `<li><code>${table.name}</code></li>`;
        }
        html += '</ul></div>';
      }

      if (d.tables.modified.length > 0) {
        html += '<div class="card"><div class="card-title">✏️ 修改表</div>';
        for (const table of d.tables.modified) {
          html += `<p><strong>${table.name}</strong></p>`;
          const cols = table.changes.columns;
          
          if (cols.added.length > 0) {
            html += `<p>新增字段: ${cols.added.map(c => `<code>${c.name}</code>`).join(', ')}</p>`;
          }
          if (cols.removed.length > 0) {
            html += `<p class="danger">删除字段: ${cols.removed.map(c => `<code>${c.name}</code>`).join(', ')}</p>`;
          }
          if (cols.modified.length > 0) {
            for (const mod of cols.modified) {
              html += `<p>修改 <code>${mod.name}</code>:`;
              for (const [key, change] of Object.entries(mod.changes)) {
                html += `<br>&nbsp;&nbsp;${key}: <code>${change.before}</code> → <code>${change.after}</code>`;
              }
              html += '</p>';
            }
          }
        }
        html += '</div>';
      }
    }

    return html;
  }

  renderHTMLRollbackTest(reportData) {
    if (!reportData.rollbackTest) {
      return '';
    }

    const rt = reportData.rollbackTest;
    const statusClass = rt.success ? 'success' : 'danger';
    const statusIcon = rt.success ? '✅' : '❌';

    let html = '<h2>回滚测试</h2>';
    html += `<div class="card"><p class="${statusClass}"><strong>${statusIcon} ${rt.success ? '通过' : '失败'}</strong></p>`;
    
    if (rt.issues && rt.issues.length > 0) {
      html += '<ul>';
      for (const issue of rt.issues) {
        html += `<li>${issue.message}</li>`;
      }
      html += '</ul>';
    }
    
    if (rt.schemaMismatch) {
      html += '<p class="danger">⚠️ 回滚后 Schema 与初始状态不一致</p>';
    }
    
    html += '</div>';
    return html;
  }

  renderHTMLAssertions(reportData) {
    if (!reportData.assertionResults || reportData.assertionResults.length === 0) {
      return '';
    }

    let html = '<h2>断言结果</h2>';
    html += '<table><thead><tr><th>类型</th><th>状态</th><th>详情</th></tr></thead><tbody>';

    for (const result of reportData.assertionResults) {
      const statusClass = result.success ? 'success' : 'danger';
      const statusIcon = result.success ? '✅' : '❌';
      
      html += `
        <tr>
          <td><code>${result.type}</code></td>
          <td class="${statusClass}">${statusIcon}</td>
          <td>${result.success ? '通过' : (result.error || '失败')}</td>
        </tr>
      `;
    }

    html += '</tbody></table>';
    return html;
  }

  getRiskLevel(reportData) {
    const riskyChanges = reportData.riskyChanges || [];
    
    if (riskyChanges.length === 0) {
      return 'safe';
    }

    const hasHighRisk = riskyChanges.some(c => c.severity === 'high');
    const hasMediumRisk = riskyChanges.some(c => c.severity === 'medium');

    if (hasHighRisk) {
      return 'high';
    } else if (hasMediumRisk) {
      return 'medium';
    }

    return 'low';
  }

  formatRiskType(type) {
    const types = {
      'table_removed': '删除表',
      'column_removed': '删除字段',
      'column_type_changed': '字段类型变更',
      'notnull_added': '新增 NOT NULL 约束',
      'default_changed': '默认值变更',
      'pk_changed': '主键变更',
      'missing_rollback': '缺少回滚脚本',
      'gap': '版本跳号',
      'duplicate': '版本重复'
    };
    return types[type] || type;
  }

  save(outputs, outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const paths = {};

    if (outputs.json) {
      const jsonPath = path.join(outputDir, 'report.json');
      fs.writeFileSync(jsonPath, outputs.json);
      paths.json = jsonPath;
      logger.success(`JSON 报告已保存: ${jsonPath}`);
    }

    if (outputs.markdown) {
      const mdPath = path.join(outputDir, 'report.md');
      fs.writeFileSync(mdPath, outputs.markdown);
      paths.markdown = mdPath;
      logger.success(`Markdown 报告已保存: ${mdPath}`);
    }

    if (outputs.html) {
      const htmlPath = path.join(outputDir, 'report.html');
      fs.writeFileSync(htmlPath, outputs.html);
      paths.html = htmlPath;
      logger.success(`HTML 报告已保存: ${htmlPath}`);
    }

    return paths;
  }
}

export default ReportGenerator;
