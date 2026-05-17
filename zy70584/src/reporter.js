const chalk = require('chalk');
const { table } = require('table');
const fs = require('fs');

function generateTerminalSummary(result) {
  console.log(chalk.bold('=' .repeat(80)));
  console.log(chalk.bold.blue('📋 OAuth回调地址校验结果'));
  console.log(chalk.gray(`检查时间: ${result.timestamp}`));
  console.log(chalk.bold('=' .repeat(80)));
  console.log('');

  const summaryData = [
    [
      chalk.bold('应用总数'),
      chalk.bold('通过'),
      chalk.bold('失败'),
      chalk.bold('错误数'),
      chalk.bold('警告数')
    ],
    [
      result.summary.totalApplications,
      chalk.green(result.summary.passedApplications),
      chalk.red(result.summary.failedApplications),
      chalk.red(result.summary.totalErrors),
      chalk.yellow(result.summary.totalWarnings)
    ]
  ];
  
  console.log(table(summaryData, {
    header: {
      alignment: 'center',
      content: '概览统计'
    }
  }));

  if (Object.keys(result.summary.errorCategories).length > 0) {
    console.log(chalk.bold.yellow('\n📊 错误分类统计:'));
    Object.entries(result.summary.errorCategories).forEach(([category, count]) => {
      console.log(`  ${chalk.red('✗')} ${category}: ${count} 个`);
    });
  }

  result.applications.forEach(app => {
    const statusIcon = app.status === 'PASSED' ? chalk.green('✓') : chalk.red('✗');
    console.log(`\n${statusIcon} 应用: ${chalk.bold(app.appName || app.appId)}`);
    
    app.environments.forEach(env => {
      const envStatusIcon = env.status === 'PASSED' ? chalk.green('✓') : chalk.red('✗');
      console.log(`   ${envStatusIcon} 环境: ${env.name}`);
      
      if (env.issues.length > 0) {
        const issuesBySeverity = {
          ERROR: [],
          WARNING: []
        };
        env.issues.forEach(issue => {
          issuesBySeverity[issue.severity].push(issue);
        });
        
        if (issuesBySeverity.ERROR.length > 0) {
          console.log(`     ${chalk.red('错误:')}`);
          issuesBySeverity.ERROR.slice(0, 3).forEach(issue => {
            console.log(`       - ${issue.message}`);
          });
          if (issuesBySeverity.ERROR.length > 3) {
            console.log(`       ... 还有 ${issuesBySeverity.ERROR.length - 3} 个错误`);
          }
        }
        
        if (issuesBySeverity.WARNING.length > 0) {
          console.log(`     ${chalk.yellow('警告:')}`);
          issuesBySeverity.WARNING.slice(0, 2).forEach(issue => {
            console.log(`       - ${issue.message}`);
          });
          if (issuesBySeverity.WARNING.length > 2) {
            console.log(`       ... 还有 ${issuesBySeverity.WARNING.length - 2} 个警告`);
          }
        }
      } else {
        console.log(`     ${chalk.green('无问题 ✓')}`);
      }
    });
  });

  if (result.matchedErrorSamples && result.matchedErrorSamples.length > 0) {
    console.log(`\n${chalk.bold.magenta('🔍 错误样本匹配结果:')}`);
    result.matchedErrorSamples.slice(0, 3).forEach(match => {
      console.log(`   样本 URL: ${chalk.cyan(match.sample.redirectUri || match.sample.url)}`);
      console.log(`   匹配应用: ${match.matched.app} (${match.matched.environment})`);
      console.log(`   匹配置信度: ${(match.matched.matchConfidence * 100).toFixed(0)}%`);
      console.log(`   差异:`);
      match.matched.differences.slice(0, 2).forEach(diff => {
        console.log(`     - ${diff}`);
      });
      console.log('');
    });
  }

  console.log('');
  console.log(chalk.bold('=' .repeat(80)));
  
  if (result.summary.hasErrors) {
    console.log(chalk.red.bold('❌ 校验失败！发现错误需要修复。'));
    console.log(chalk.gray('   详细报告和建议请查看生成的 JSON/HTML 文件。'));
  } else if (result.summary.hasWarnings) {
    console.log(chalk.yellow.bold('⚠️  校验通过，但有警告建议检查。'));
  } else {
    console.log(chalk.green.bold('✅ 全部校验通过！'));
  }
  
  console.log(chalk.bold('=' .repeat(80)));
}

function generateJsonReport(result, filePath) {
  const jsonContent = JSON.stringify(result, null, 2);
  fs.writeFileSync(filePath, jsonContent, 'utf-8');
}

function generateReadableReport(result, filePath) {
  const html = generateHtmlReport(result);
  fs.writeFileSync(filePath, html, 'utf-8');
}

function generateHtmlReport(result) {
  const statusColor = result.summary.hasErrors ? '#dc2626' : 
                      result.summary.hasWarnings ? '#f59e0b' : '#16a34a';
  const statusText = result.summary.hasErrors ? '校验失败' : 
                     result.summary.hasWarnings ? '有警告' : '校验通过';

  let applicationsHtml = '';
  result.applications.forEach(app => {
    const appStatusColor = app.status === 'PASSED' ? '#16a34a' : '#dc2626';
    const appStatusText = app.status === 'PASSED' ? '通过' : '失败';
    
    let environmentsHtml = '';
    app.environments.forEach(env => {
      const envStatusColor = env.status === 'PASSED' ? '#16a34a' : '#dc2626';
      const envStatusText = env.status === 'PASSED' ? '通过' : '失败';
      
      let urisHtml = '';
      if (env.authorizedUris && env.authorizedUris.length > 0) {
        urisHtml = `
          <div style="margin-top: 12px;">
            <h4 style="margin: 0 0 8px 0; color: #4b5563;">授权回调地址列表:</h4>
            <ul style="margin: 0; padding-left: 20px;">
              ${env.authorizedUris.map(uri => `
                <li style="margin-bottom: 4px; font-family: monospace; font-size: 12px;">
                  <span style="color: ${uri.isValid ? '#16a34a' : '#dc2626'}">${uri.isValid ? '✓' : '✗'}</span>
                  ${uri.original}
                  ${!uri.isValid ? `<span style="color: #dc2626; font-size: 11px;">(无效: ${uri.errors[0]?.message})</span>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
        `;
      }
      
      let issuesHtml = '';
      if (env.issues && env.issues.length > 0) {
        const errors = env.issues.filter(i => i.severity === 'ERROR');
        const warnings = env.issues.filter(i => i.severity === 'WARNING');
        
        issuesHtml = `
          <div style="margin-top: 12px;">
            <h4 style="margin: 0 0 8px 0; color: #4b5563;">发现问题:</h4>
            ${errors.length > 0 ? `
              <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 8px 12px; margin-bottom: 8px;">
                <strong style="color: #dc2626;">错误 (${errors.length}):</strong>
                <ul style="margin: 4px 0 0 0; padding-left: 20px;">
                  ${errors.map(e => `
                    <li style="color: #991b1b; margin-bottom: 4px;">
                      ${e.message}
                      ${e.suggestion && e.suggestion.length > 0 ? `
                        <br><span style="color: #6b7280; font-size: 11px;">💡 建议: ${e.suggestion[0]}</span>
                      ` : ''}
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
            ${warnings.length > 0 ? `
              <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 8px 12px;">
                <strong style="color: #f59e0b;">警告 (${warnings.length}):</strong>
                <ul style="margin: 4px 0 0 0; padding-left: 20px;">
                  ${warnings.map(w => `
                    <li style="color: #92400e; margin-bottom: 4px;">
                      ${w.message}
                      ${w.suggestion && w.suggestion.length > 0 ? `
                        <br><span style="color: #6b7280; font-size: 11px;">💡 建议: ${w.suggestion[0]}</span>
                      ` : ''}
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `;
      }
      
      environmentsHtml += `
        <div style="background: #f9fafb; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600;">${env.name}</span>
            <span style="background: ${envStatusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
              ${envStatusText}
            </span>
          </div>
          ${urisHtml}
          ${issuesHtml}
        </div>
      `;
    });
    
    applicationsHtml += `
      <div style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 18px;">${app.appName || app.appId}</h3>
          <span style="background: ${appStatusColor}; color: white; padding: 4px 12px; border-radius: 4px; font-weight: 600;">
            ${appStatusText}
          </span>
        </div>
        <div style="color: #6b7280; font-size: 12px; margin-bottom: 12px;">
          来源文件: ${app.source.file} | 位置: 第 ${app.source.index + 1} 个应用
        </div>
        ${environmentsHtml}
      </div>
    `;
  });

  let errorSamplesHtml = '';
  if (result.matchedErrorSamples && result.matchedErrorSamples.length > 0) {
    errorSamplesHtml = `
      <h2 style="color: #1f2937; margin-top: 32px; margin-bottom: 16px;">🔍 错误样本匹配</h2>
      ${result.matchedErrorSamples.map(match => `
        <div style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="margin-bottom: 8px;">
            <strong>样本 URL:</strong> <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${match.sample.redirectUri || match.sample.url}</code>
          </div>
          <div style="margin-bottom: 8px;">
            <strong>匹配应用:</strong> ${match.matched.app} (${match.matched.environment})
          </div>
          <div style="margin-bottom: 8px;">
            <strong>匹配置信度:</strong> ${(match.matched.matchConfidence * 100).toFixed(0)}%
          </div>
          <div>
            <strong>差异:</strong>
            <ul style="margin: 4px 0 0 0; padding-left: 20px; color: #dc2626;">
              ${match.matched.differences.map(d => `<li>${d}</li>`).join('')}
            </ul>
          </div>
        </div>
      `).join('')}
    `;
  }

  let envComparisonHtml = '';
  if (result.environmentComparison && result.environmentComparison.applications && result.environmentComparison.applications.length > 0) {
    envComparisonHtml = `
      <h2 style="color: #1f2937; margin-top: 32px; margin-bottom: 16px;">🔄 环境差异对比</h2>
      ${result.environmentComparison.applications.map(app => `
        <div style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="margin: 0 0 12px 0; font-size: 16px;">${app.appName || app.appId}</h3>
          ${app.environmentPairs.map(pair => `
            <div style="background: #fef3c7; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
              <strong>环境对比: ${pair.env1} ↔ ${pair.env2}</strong>
              <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                ${pair.differences.map(d => `<li style="color: #92400e; margin-bottom: 4px;">${d.message}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
      `).join('')}
    `;
  }

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OAuth回调地址校验报告</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f3f4f6;
      margin: 0;
      padding: 24px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .summary-card {
      background: white;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .status-badge {
      display: inline-block;
      padding: 8px 24px;
      border-radius: 6px;
      font-size: 18px;
      font-weight: 600;
      color: white;
      margin-bottom: 16px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .stat-item {
      text-align: center;
      padding: 12px;
      background: #f9fafb;
      border-radius: 6px;
    }
    .stat-number {
      font-size: 24px;
      font-weight: 700;
      display: block;
    }
    .stat-label {
      font-size: 12px;
      color: #6b7280;
    }
    .error-categories {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
    }
    .category-item {
      display: inline-block;
      background: #fef2f2;
      color: #dc2626;
      padding: 4px 12px;
      border-radius: 4px;
      margin-right: 8px;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .footer {
      text-align: center;
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #1f2937; margin-bottom: 8px;">📋 OAuth回调地址校验报告</h1>
      <p style="color: #6b7280;">检查时间: ${new Date(result.timestamp).toLocaleString('zh-CN')}</p>
    </div>
    
    <div class="summary-card">
      <div style="text-align: center;">
        <span class="status-badge" style="background: ${statusColor};">${statusText}</span>
      </div>
      
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-number" style="color: #374151;">${result.summary.totalApplications}</span>
          <span class="stat-label">应用总数</span>
        </div>
        <div class="stat-item">
          <span class="stat-number" style="color: #16a34a;">${result.summary.passedApplications}</span>
          <span class="stat-label">通过</span>
        </div>
        <div class="stat-item">
          <span class="stat-number" style="color: #dc2626;">${result.summary.failedApplications}</span>
          <span class="stat-label">失败</span>
        </div>
        <div class="stat-item">
          <span class="stat-number" style="color: #dc2626;">${result.summary.totalErrors}</span>
          <span class="stat-label">错误数</span>
        </div>
        <div class="stat-item">
          <span class="stat-number" style="color: #f59e0b;">${result.summary.totalWarnings}</span>
          <span class="stat-label">警告数</span>
        </div>
      </div>
      
      ${Object.keys(result.summary.errorCategories).length > 0 ? `
        <div class="error-categories">
          <strong style="color: #4b5563;">错误分类:</strong><br>
          ${Object.entries(result.summary.errorCategories).map(([category, count]) => `
            <span class="category-item">${category} (${count})</span>
          `).join('')}
        </div>
      ` : ''}
    </div>
    
    <h2 style="color: #1f2937; margin-bottom: 16px;">📦 应用校验详情</h2>
    ${applicationsHtml}
    
    ${errorSamplesHtml}
    
    ${envComparisonHtml}
    
    <div class="footer">
      <p>OAuth回调地址校验工具 | 此报告由系统自动生成</p>
      <p>💡 提示: 点击终端摘要中的链接查看完整JSON数据</p>
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = {
  generateTerminalSummary,
  generateJsonReport,
  generateReadableReport,
  generateHtmlReport
};
