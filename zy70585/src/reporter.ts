import * as fs from 'fs';
import * as path from 'path';
import * as ejs from 'ejs';
import chalk from 'chalk';
import { table } from 'table';
import { CheckResult, ReportData, OutputOptions } from './types';

export function generateReportData(
  results: CheckResult[],
  badLines: Array<{ line: string; lineNumber: number; reason: string }>,
  config: any
): ReportData {
  const normal = results.filter(r => r.isNormal).length;
  const abnormal = results.filter(r => !r.isNormal).length;
  const anomalyCount = results.reduce((sum, r) => sum + r.anomalies.length, 0);

  return {
    summary: {
      total: results.length + badLines.length,
      normal,
      abnormal: abnormal + badLines.length,
      anomalyCount
    },
    results,
    config,
    generatedAt: new Date().toISOString()
  };
}

export function outputTerminal(
  reportData: ReportData,
  badLines: Array<{ line: string; lineNumber: number; reason: string }>
): void {
  console.log('\n');
  console.log(chalk.bold.blue('═'.repeat(60)));
  console.log(chalk.bold.blue('  反向代理头检查报告'));
  console.log(chalk.bold.blue('═'.repeat(60)));
  console.log(`\n生成时间: ${new Date(reportData.generatedAt).toLocaleString()}`);
  console.log('\n' + chalk.bold('📊 摘要'));
  console.log(chalk.gray('─'.repeat(40)));
  
  const summaryData = [
    ['总样本数', reportData.summary.total],
    ['正常样本', chalk.green(reportData.summary.normal)],
    ['异常样本', chalk.red(reportData.summary.abnormal)],
    ['异常总数', chalk.yellow(reportData.summary.anomalyCount)]
  ];
  console.log(table(summaryData, {
    border: {
      topBody: '',
      topJoin: '',
      topLeft: '',
      topRight: '',
      bottomBody: '',
      bottomJoin: '',
      bottomLeft: '',
      bottomRight: '',
      bodyLeft: '',
      bodyRight: '',
      bodyJoin: ' │ ',
      joinBody: '',
      joinLeft: '',
      joinRight: '',
      joinJoin: ''
    },
    drawHorizontalLine: () => false
  }));

  if (badLines.length > 0) {
    console.log('\n' + chalk.bold('❌ 无法解析的行'));
    console.log(chalk.gray('─'.repeat(40)));
    badLines.forEach(bad => {
      console.log(chalk.red(`  [第 ${bad.lineNumber} 行] ${bad.reason}`));
      console.log(chalk.gray(`  原始内容: ${bad.line.substring(0, 100)}${bad.line.length > 100 ? '...' : ''}`));
      console.log('');
    });
  }

  const abnormalResults = reportData.results.filter(r => !r.isNormal);
  if (abnormalResults.length > 0) {
    console.log('\n' + chalk.bold('⚠️  异常样本详情'));
    console.log(chalk.gray('─'.repeat(40)));
    abnormalResults.forEach(result => {
      console.log(`\n${chalk.yellow(`样本 #${result.sample.lineNumber}`)}`);
      console.log(`  真实IP: ${result.realIp}`);
      console.log(`  真实协议: ${result.realProtocol}`);
      console.log(`  可信代理层级: ${result.trustedProxyCount}`);
      console.log('  异常:');
      result.anomalies.forEach(anomaly => {
        const severityColor = anomaly.severity === 'high' ? chalk.red : 
                              anomaly.severity === 'medium' ? chalk.yellow : chalk.blue;
        console.log(`    - ${severityColor(`[${anomaly.severity.toUpperCase()}]`)} ${anomaly.header}: ${anomaly.message}`);
      });
    });
  }

  console.log('\n' + chalk.bold('✅ 正常样本 (原始输出)'));
  console.log(chalk.gray('─'.repeat(40)));
  reportData.results.filter(r => r.isNormal).forEach(result => {
    console.log(result.sample.raw);
  });

  console.log('\n');
}

export function outputJson(reportData: ReportData, badLines: any[], filePath: string): void {
  const output = {
    ...reportData,
    badLines
  };
  fs.writeFileSync(path.resolve(filePath), JSON.stringify(output, null, 2), 'utf-8');
  console.log(chalk.green(`✓ JSON报告已保存到: ${filePath}`));
}

export function outputHtml(reportData: ReportData, badLines: any[], filePath: string): void {
  const template = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>反向代理头检查报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f7fa; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header .time { opacity: 0.9; }
        .summary { padding: 30px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .summary-card { padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card.total { background: #e3f2fd; }
        .summary-card.normal { background: #e8f5e9; }
        .summary-card.abnormal { background: #ffebee; }
        .summary-card.anomalies { background: #fff3e0; }
        .summary-card .number { font-size: 36px; font-weight: bold; }
        .summary-card .label { font-size: 14px; color: #666; margin-top: 5px; }
        .section { padding: 0 30px 30px; }
        .section h2 { font-size: 20px; margin-bottom: 15px; color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .bad-lines .line-item { background: #ffebee; padding: 15px; border-radius: 6px; margin-bottom: 10px; }
        .bad-lines .line-number { font-weight: bold; color: #c62828; }
        .bad-lines .reason { color: #e53935; margin: 5px 0; }
        .bad-lines .raw { color: #666; font-family: monospace; font-size: 13px; word-break: break-all; }
        .anomaly-item { background: #fff3e0; padding: 15px; border-radius: 6px; margin-bottom: 10px; }
        .anomaly-item .sample-header { font-weight: bold; color: #e65100; margin-bottom: 10px; }
        .anomaly-item .detail { margin: 5px 0; color: #555; }
        .anomaly-item .anomaly { margin: 8px 0 0 20px; padding: 8px; background: rgba(255,255,255,0.7); border-radius: 4px; }
        .severity-high { color: #d32f2f; font-weight: bold; }
        .severity-medium { color: #f57c00; font-weight: bold; }
        .severity-low { color: #1976d2; font-weight: bold; }
        .normal-samples { background: #f5f5f5; padding: 20px; border-radius: 6px; }
        .normal-samples pre { margin: 5px 0; font-family: monospace; font-size: 13px; color: #333; }
        .config-info { background: #fafafa; padding: 20px; border-radius: 6px; font-family: monospace; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 反向代理头检查报告</h1>
            <div class="time">生成时间: <%= new Date(generatedAt).toLocaleString() %></div>
        </div>
        
        <div class="summary">
            <div class="summary-card total">
                <div class="number"><%= summary.total %></div>
                <div class="label">总样本数</div>
            </div>
            <div class="summary-card normal">
                <div class="number"><%= summary.normal %></div>
                <div class="label">正常样本</div>
            </div>
            <div class="summary-card abnormal">
                <div class="number"><%= summary.abnormal %></div>
                <div class="label">异常样本</div>
            </div>
            <div class="summary-card anomalies">
                <div class="number"><%= summary.anomalyCount %></div>
                <div class="label">异常总数</div>
            </div>
        </div>

        <div class="section">
            <h2>⚙️ 代理配置</h2>
            <div class="config-info">
                可信代理IP: <%= config.trustedProxies.join(', ') %><br>
                信任层级: <%= config.trustDepth %><br>
                监控Header: <%= config.trustedHeaders.join(', ') %>
            </div>
        </div>

        <% if (badLines && badLines.length > 0) { %>
        <div class="section">
            <h2>❌ 无法解析的行</h2>
            <div class="bad-lines">
                <% badLines.forEach(function(bad) { %>
                <div class="line-item">
                    <div class="line-number">第 <%= bad.lineNumber %> 行</div>
                    <div class="reason">原因: <%= bad.reason %></div>
                    <div class="raw">原始内容: <%= bad.line %></div>
                </div>
                <% }) %>
            </div>
        </div>
        <% } %>

        <% var abnormalResults = results.filter(function(r) { return !r.isNormal; }) %>
        <% if (abnormalResults.length > 0) { %>
        <div class="section">
            <h2>⚠️ 异常样本详情</h2>
            <% abnormalResults.forEach(function(result) { %>
            <div class="anomaly-item">
                <div class="sample-header">样本 #<%= result.sample.lineNumber %></div>
                <div class="detail">真实IP: <%= result.realIp %></div>
                <div class="detail">真实协议: <%= result.realProtocol %></div>
                <div class="detail">可信代理层级: <%= result.trustedProxyCount %></div>
                <div class="detail">异常:</div>
                <% result.anomalies.forEach(function(anomaly) { %>
                <div class="anomaly">
                    <span class="severity-<%= anomaly.severity %>">[<%= anomaly.severity.toUpperCase() %>]</span>
                    <strong><%= anomaly.header %></strong>: <%= anomaly.message %>
                </div>
                <% }) %>
            </div>
            <% }) %>
        </div>
        <% } %>

        <% var normalResults = results.filter(function(r) { return r.isNormal; }) %>
        <% if (normalResults.length > 0) { %>
        <div class="section">
            <h2>✅ 正常样本</h2>
            <div class="normal-samples">
                <% normalResults.forEach(function(result) { %>
                <pre><%= result.sample.raw %></pre>
                <% }) %>
            </div>
        </div>
        <% } %>
    </div>
</body>
</html>
  `;

  const html = ejs.render(template, { ...reportData, badLines });
  fs.writeFileSync(path.resolve(filePath), html, 'utf-8');
  console.log(chalk.green(`✓ HTML报告已保存到: ${filePath}`));
}
