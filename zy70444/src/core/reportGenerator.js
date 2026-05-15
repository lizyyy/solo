const fs = require('fs');
const path = require('path');
const Table = require('cli-table3');
const chalk = require('chalk');

class ReportGenerator {
  constructor() {
    this.reportsPath = './reports';
    this.ensureReportsPathExists();
  }

  ensureReportsPathExists() {
    if (!fs.existsSync(this.reportsPath)) {
      fs.mkdirSync(this.reportsPath, { recursive: true });
    }
  }

  generateSummaryHash(input, action, conclusion) {
    const summary = {
      input: JSON.stringify(input),
      action,
      conclusion,
      timestamp: new Date().toISOString()
    };
    return Buffer.from(JSON.stringify(summary)).toString('base64').substring(0, 64);
  }

  generateCliReport(results, executionTime, batchId) {
    const validCount = results.filter(r => r.result.valid).length;
    const invalidCount = results.filter(r => !r.result.valid).length;
    const algorithmMismatch = results.filter(r => r.result.error && r.result.error.includes('签名算法不一致')).length;

    console.log('\n' + chalk.bgBlue.white.bold(' 队列消息体检查报告 ') + '\n');
    
    console.log(chalk.cyan('批次信息:'));
    const batchTable = new Table({
      head: ['批次ID', '执行时间', '消息总数', '有效消息', '无效消息', '算法不一致'],
      colWidths: [20, 20, 12, 12, 12, 14]
    });
    batchTable.push([batchId, `${executionTime}ms`, results.length, validCount, invalidCount, algorithmMismatch]);
    console.log(batchTable.toString() + '\n');

    console.log(chalk.cyan('处理前后对比:'));
    const compareTable = new Table({
      head: ['消息ID', '手机号', '处理前算法', '处理后状态', '问题说明'],
      colWidths: [22, 15, 15, 15, 30]
    });
    
    results.forEach(r => {
      const status = r.result.valid ? chalk.green('通过') : chalk.red('失败');
      const issue = r.result.error || '无';
      compareTable.push([
        r.message.messageId,
        r.message.phone,
        r.message.signMethod,
        status,
        issue
      ]);
    });
    console.log(compareTable.toString() + '\n');

    if (algorithmMismatch > 0) {
      console.log(chalk.yellow('⚠️  签名算法不一致详情:'));
      const mismatchTable = new Table({
        head: ['消息ID', '期望算法', '实际算法', '期望签名', '实际签名'],
        colWidths: [22, 12, 12, 35, 35]
      });
      
      results.filter(r => r.result.error && r.result.error.includes('签名算法不一致')).forEach(r => {
        mismatchTable.push([
          r.message.messageId,
          r.result.expectedAlgorithm,
          r.result.actualAlgorithm,
          r.result.expectedSign.substring(0, 32) + '...',
          r.result.actualSign.substring(0, 32) + '...'
        ]);
      });
      console.log(mismatchTable.toString() + '\n');
    }

    console.log(chalk.cyan('物流拦截复核样例:'));
    console.log(chalk.gray('┌─────────────────────────────────────────────────────────────────────────┐'));
    console.log(chalk.gray('│') + '  📦 物流拦截系统截图                                                 ' + chalk.gray('│'));
    console.log(chalk.gray('│') + '  ┌───────────────────────────────────────────────────────────────────┐  ' + chalk.gray('│'));
    console.log(chalk.gray('│') + '  │  运单号: SF1234567890    状态: 已拦截                          │  ' + chalk.gray('│'));
    console.log(chalk.gray('│') + '  │  手机号: 13900009999    拦截原因: 签名算法异常                  │  ' + chalk.gray('│'));
    console.log(chalk.gray('│') + '  │  消息ID: MSG_XXXXXX_XXXX    时间: ' + new Date().toLocaleString().substring(0, 19) + '            │  ' + chalk.gray('│'));
    console.log(chalk.gray('│') + '  │                                                                   │  ' + chalk.gray('│'));
    console.log(chalk.gray('│') + '  │  [ ] 确认拦截    [ ] 放行    [ ] 转人工复核                       │  ' + chalk.gray('│'));
    console.log(chalk.gray('│') + '  └───────────────────────────────────────────────────────────────────┘  ' + chalk.gray('│'));
    console.log(chalk.gray('└─────────────────────────────────────────────────────────────────────────┘') + '\n');

    this.printNextSteps(results);
  }

  printNextSteps(results) {
    console.log(chalk.magenta('📋 下一步建议:'));
    
    const steps = [];
    const algorithmMismatch = results.filter(r => r.result.error && r.result.error.includes('签名算法不一致'));
    
    if (algorithmMismatch.length > 0) {
      steps.push(chalk.yellow('1. 导出异常样本供同事复核:') + ' qmc export --batch <批次ID> --output abnormal.json');
      steps.push(chalk.yellow('2. 联系开发团队检查签名算法配置，确认为什么使用了错误的算法'));
      steps.push(chalk.yellow('3. 对异常消息进行重签名后重新提交验证'));
    }
    
    const validCount = results.filter(r => r.result.valid).length;
    if (validCount > 0) {
      steps.push(chalk.green('4. 验证通过的消息可以安全进入发送队列'));
    }
    
    steps.push(chalk.cyan('5. 查看历史处理记录:') + ' qmc history');
    steps.push(chalk.cyan('6. 重新运行完整验证流程:') + ' qmc verify --input messages.json');
    
    steps.forEach((step, index) => {
      console.log(`   ${step}`);
    });
    console.log('');
  }

  generateHtmlReport(results, executionTime, batchId, previewData = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `report_${batchId}_${timestamp}.html`;
    const filepath = path.join(this.reportsPath, filename);

    const validCount = results.filter(r => r.result.valid).length;
    const invalidCount = results.filter(r => !r.result.valid).length;
    const algorithmMismatch = results.filter(r => r.result.error && r.result.error.includes('签名算法不一致')).length;

    const summaryHash = this.generateSummaryHash(
      { total: results.length, batchId },
      'verify_signature',
      { valid: validCount, invalid: invalidCount, algorithmMismatch }
    );

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>队列消息体检查报告 - ${batchId}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header .meta { opacity: 0.9; font-size: 14px; }
        .summary { display: grid; grid-template-columns: repeat(6, 1fr); gap: 15px; padding: 25px; background: #f8f9fa; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .stat-card .number { font-size: 32px; font-weight: bold; color: #333; }
        .stat-card .label { font-size: 12px; color: #666; margin-top: 5px; }
        .stat-card.success .number { color: #10b981; }
        .stat-card.danger .number { color: #ef4444; }
        .stat-card.warning .number { color: #f59e0b; }
        .section { padding: 25px; border-bottom: 1px solid #eee; }
        .section h2 { font-size: 18px; color: #333; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
        .section h2::before { content: ''; width: 4px; height: 18px; background: #667eea; border-radius: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; font-weight: 600; color: #333; }
        tr:hover { background: #f8f9fa; }
        .badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; }
        .badge-success { background: #d1fae5; color: #065f46; }
        .badge-danger { background: #fee2e2; color: #991b1b; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .screenshot-mock { background: #1a1a2e; border-radius: 8px; padding: 20px; color: #eee; font-family: monospace; margin-top: 15px; }
        .screenshot-mock .window-bar { height: 24px; background: #2d2d44; border-radius: 6px 6px 0 0; margin: -20px -20px 15px -20px; padding: 0 15px; display: flex; align-items: center; gap: 8px; }
        .screenshot-mock .dot { width: 12px; height: 12px; border-radius: 50%; }
        .screenshot-mock .dot.red { background: #ff5f57; }
        .screenshot-mock .dot.yellow { background: #ffbd2e; }
        .screenshot-mock .dot.green { background: #28ca42; }
        .logistics-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; margin-top: 10px; }
        .next-steps { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 0 8px 8px 0; }
        .next-steps h3 { color: #92400e; margin-bottom: 10px; }
        .next-steps ul { margin-left: 20px; color: #78350f; }
        .next-steps li { margin: 8px 0; }
        .hash-box { background: #1f2937; color: #10b981; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 12px; word-break: break-all; }
        .export-btn { display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 15px; }
        .export-btn:hover { background: #5a67d8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 队列消息体检查报告</h1>
            <div class="meta">批次ID: ${batchId} | 生成时间: ${new Date().toLocaleString()} | 执行耗时: ${executionTime}ms</div>
        </div>
        
        <div class="summary">
            <div class="stat-card"><div class="number">${results.length}</div><div class="label">消息总数</div></div>
            <div class="stat-card success"><div class="number">${validCount}</div><div class="label">验证通过</div></div>
            <div class="stat-card danger"><div class="number">${invalidCount}</div><div class="label">验证失败</div></div>
            <div class="stat-card warning"><div class="number">${algorithmMismatch}</div><div class="label">算法不一致</div></div>
            <div class="stat-card"><div class="number">${((validCount/results.length)*100).toFixed(1)}%</div><div class="label">通过率</div></div>
            <div class="stat-card"><div class="number">${executionTime}ms</div><div class="label">执行时间</div></div>
        </div>

        <div class="section">
            <h2>🔍 处理前后对比</h2>
            <table>
                <thead>
                    <tr><th>消息ID</th><th>手机号</th><th>内容摘要</th><th>签名算法</th><th>处理前状态</th><th>处理后状态</th><th>问题说明</th></tr>
                </thead>
                <tbody>
                    ${results.map(r => `
                    <tr>
                        <td><code>${r.message.messageId}</code></td>
                        <td>${r.message.phone}</td>
                        <td>${r.message.content.substring(0, 20)}...</td>
                        <td><span class="badge ${r.result.valid ? 'badge-success' : 'badge-warning'}">${r.message.signMethod}</span></td>
                        <td><span class="badge badge-warning">待验证</span></td>
                        <td><span class="badge ${r.result.valid ? 'badge-success' : 'badge-danger'}">${r.result.valid ? '通过' : '失败'}</span></td>
                        <td>${r.result.error || '-'}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>

        ${algorithmMismatch > 0 ? `<div class="section">
            <h2>⚠️ 签名算法不一致详情</h2>
            <table>
                <thead>
                    <tr><th>消息ID</th><th>期望算法</th><th>实际算法</th><th>期望签名</th><th>实际签名</th></tr>
                </thead>
                <tbody>
                    ${results.filter(r => r.result.error && r.result.error.includes('签名算法不一致')).map(r => `
                    <tr>
                        <td><code>${r.message.messageId}</code></td>
                        <td><span class="badge badge-success">${r.result.expectedAlgorithm}</span></td>
                        <td><span class="badge badge-danger">${r.result.actualAlgorithm}</span></td>
                        <td><code style="font-size:11px">${r.result.expectedSign.substring(0, 32)}...</code></td>
                        <td><code style="font-size:11px">${r.result.actualSign.substring(0, 32)}...</code></td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>` : ''}

        <div class="section">
            <h2>📦 物流拦截复核样例</h2>
            <div class="screenshot-mock">
                <div class="window-bar">
                    <span class="dot red"></span>
                    <span class="dot yellow"></span>
                    <span class="dot green"></span>
                    <span style="margin-left: 10px; color: #999;">物流拦截管理系统 - 复核页面</span>
                </div>
                <div class="logistics-card">
                    <div style="font-size: 16px; font-weight: bold; margin-bottom: 15px;">📦 运单拦截复核</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <div style="color: #ccc; font-size: 11px;">运单号</div>
                            <div style="font-size: 14px;">SF1234567890</div>
                        </div>
                        <div>
                            <div style="color: #ccc; font-size: 11px;">当前状态</div>
                            <div style="font-size: 14px; color: #fbbf24;">🔴 已拦截</div>
                        </div>
                        <div>
                            <div style="color: #ccc; font-size: 11px;">收件人手机</div>
                            <div style="font-size: 14px;">13900009999</div>
                        </div>
                        <div>
                            <div style="color: #ccc; font-size: 11px;">拦截原因</div>
                            <div style="font-size: 14px; color: #f87171;">签名算法异常</div>
                        </div>
                        <div>
                            <div style="color: #ccc; font-size: 11px;">关联消息ID</div>
                            <div style="font-size: 12px; font-family: monospace;">${results[0]?.message.messageId || 'MSG_DEMO_001'}</div>
                        </div>
                        <div>
                            <div style="color: #ccc; font-size: 11px;">拦截时间</div>
                            <div style="font-size: 14px;">${new Date().toLocaleString()}</div>
                        </div>
                    </div>
                    <div style="margin-top: 20px; display: flex; gap: 10px;">
                        <button style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 4px;">✅ 确认拦截</button>
                        <button style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px;">🚚 放行</button>
                        <button style="background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 4px;">👥 转人工复核</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🔗 导出摘要 (输入-动作-结论)</h2>
            <div class="hash-box">${summaryHash}</div>
            <div style="margin-top: 10px; font-size: 12px; color: #666;">
                <strong>输入:</strong> ${results.length} 条消息 (批次 ${batchId})<br>
                <strong>动作:</strong> 签名算法验证与一致性检查<br>
                <strong>结论:</strong> 通过 ${validCount} 条, 失败 ${invalidCount} 条 (其中算法不一致 ${algorithmMismatch} 条)
            </div>
        </div>

        <div class="section">
            <div class="next-steps">
                <h3>📋 下一步建议</h3>
                <ul>
                    ${algorithmMismatch > 0 ? `
                    <li><strong>导出异常样本:</strong> 使用 <code>qmc export --batch ${batchId} --output abnormal.json</code> 导出给同事复核</li>
                    <li><strong>检查算法配置:</strong> 联系开发团队确认为什么使用了错误的签名算法</li>
                    <li><strong>重签名重发:</strong> 对异常消息使用正确算法重签名后重新提交验证</li>
                    ` : ''}
                    <li><strong>正常消息入队:</strong> ${validCount} 条验证通过的消息可以安全进入发送队列</li>
                    <li><strong>查看历史记录:</strong> 使用 <code>qmc history</code> 查看所有历史处理批次</li>
                    <li><strong>生成复核报告:</strong> 导出完整报告供质量团队审计</li>
                </ul>
            </div>
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync(filepath, html);
    return filepath;
  }

  exportAbnormalSamples(results, exportPath) {
    const abnormalResults = results.filter(r => !r.result.valid);
    const exportData = {
      exportTime: new Date().toISOString(),
      count: abnormalResults.length,
      records: abnormalResults
    };
    
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    return exportPath;
  }
}

module.exports = ReportGenerator;