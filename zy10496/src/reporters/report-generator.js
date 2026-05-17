const fs = require('fs');
const path = require('path');

async function generateReports(filterResult, parseResult, outputDir, options) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const reportData = {
    generatedAt: new Date().toISOString(),
    inputPath: parseResult.inputPath,
    summary: {
      totalRecords: filterResult.totalRecords,
      botCount: filterResult.botCount,
      suspiciousCount: filterResult.suspiciousCount,
      cleanCount: filterResult.cleanCount,
      badLineCount: parseResult.badLineCount,
      botPercentage: filterResult.totalRecords > 0 
        ? ((filterResult.botCount / filterResult.totalRecords) * 100).toFixed(2) 
        : 0
    },
    topBotIPs: filterResult.topBotIPs,
    topBotUAs: filterResult.topBotUAs,
    topSuspiciousPaths: filterResult.topSuspiciousPaths,
    matchedRules: filterResult.matchedRules,
    scoring: filterResult.scoring
  };

  if (options.json !== false) {
    const jsonPath = path.join(outputDir, 'report-summary.json');
    fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2), 'utf8');
    console.log(`   ✅ 已生成摘要报告: ${jsonPath}`);

    const samplesPath = path.join(outputDir, 'samples');
    if (!fs.existsSync(samplesPath)) {
      fs.mkdirSync(samplesPath, { recursive: true });
    }

    const botSamplesPath = path.join(samplesPath, 'bot-samples.json');
    fs.writeFileSync(botSamplesPath, JSON.stringify(
      filterResult.botRecords.map(r => ({
        ip: r.ip,
        path: r.path,
        userAgent: r.userAgent,
        status: r.status,
        timestamp: r.timestamp,
        source: `${r.sourceFile}:${r.lineNumber}`,
        score: r.analysis.score,
        matchedRules: r.analysis.matchedRules
      })), null, 2
    ), 'utf8');

    const suspiciousSamplesPath = path.join(samplesPath, 'suspicious-samples.json');
    fs.writeFileSync(suspiciousSamplesPath, JSON.stringify(
      filterResult.suspiciousRecords.map(r => ({
        ip: r.ip,
        path: r.path,
        userAgent: r.userAgent,
        status: r.status,
        timestamp: r.timestamp,
        source: `${r.sourceFile}:${r.lineNumber}`,
        score: r.analysis.score,
        matchedRules: r.analysis.matchedRules
      })), null, 2
    ), 'utf8');

    if (parseResult.badLines.length > 0) {
      const badLinesPath = path.join(outputDir, 'bad-lines.json');
      fs.writeFileSync(badLinesPath, JSON.stringify(parseResult.badLines, null, 2), 'utf8');
      console.log(`   ✅ 已导出坏行记录: ${badLinesPath}`);
    }

    const cleanLogPath = path.join(outputDir, 'clean-access.log');
    const cleanLines = filterResult.allCleanRecords.map(r => r.rawLine);
    fs.writeFileSync(cleanLogPath, cleanLines.join('\n'), 'utf8');
    console.log(`   ✅ 已导出净化日志: ${cleanLogPath}`);

    const botLogPath = path.join(outputDir, 'bot-access.log');
    const botLines = filterResult.allBotRecords.map(r => r.rawLine);
    fs.writeFileSync(botLogPath, botLines.join('\n'), 'utf8');
    console.log(`   ✅ 已导出机器人日志: ${botLogPath}`);
  }

  if (options.report !== false) {
    const htmlPath = path.join(outputDir, 'report.html');
    const htmlContent = generateHTMLReport(reportData, filterResult, parseResult);
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    console.log(`   ✅ 已生成HTML报告: ${htmlPath}`);
  }
}

function generateHTMLReport(reportData, filterResult, parseResult) {
  const summary = reportData.summary;
  const botPercent = summary.botPercentage;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>爬虫流量分析报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header p { opacity: 0.9; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .stat-card.bot { border-left: 4px solid #ef4444; }
        .stat-card.suspicious { border-left: 4px solid #f59e0b; }
        .stat-card.clean { border-left: 4px solid #10b981; }
        .stat-card.total { border-left: 4px solid #3b82f6; }
        .stat-value { font-size: 36px; font-weight: bold; margin-bottom: 5px; }
        .stat-label { color: #6b7280; font-size: 14px; }
        .stat-percent { font-size: 14px; margin-top: 8px; }
        .section { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .section h2 { font-size: 20px; margin-bottom: 20px; color: #1f2937; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; color: #374151; }
        tr:hover { background: #f9fafb; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .badge.bot { background: #fee2e2; color: #dc2626; }
        .badge.suspicious { background: #fef3c7; color: #d97706; }
        .badge.clean { background: #d1fae5; color: #059669; }
        .progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-top: 8px; }
        .progress-fill { height: 100%; border-radius: 4px; }
        .progress-fill.bot { background: #ef4444; }
        .progress-fill.suspicious { background: #f59e0b; }
        .progress-fill.clean { background: #10b981; }
        .ua-preview { max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; font-size: 12px; color: #6b7280; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .alert { padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin-bottom: 20px; }
        code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 爬虫流量分析报告</h1>
            <p>生成时间: ${new Date(reportData.generatedAt).toLocaleString('zh-CN')}</p>
            <p>输入源: ${reportData.inputPath}</p>
        </div>

        ${parseResult.badLineCount > 0 ? `
        <div class="alert">
            <strong>⚠️ 警告:</strong> 检测到 ${parseResult.badLineCount} 行解析失败的日志，请查看 bad-lines.json 获取详情。
        </div>
        ` : ''}

        <div class="stats-grid">
            <div class="stat-card bot">
                <div class="stat-value" style="color: #ef4444;">${summary.botCount.toLocaleString()}</div>
                <div class="stat-label">机器人流量</div>
                <div class="stat-percent">${botPercent}%</div>
                <div class="progress-bar"><div class="progress-fill bot" style="width: ${botPercent}%"></div></div>
            </div>
            <div class="stat-card suspicious">
                <div class="stat-value" style="color: #f59e0b;">${summary.suspiciousCount.toLocaleString()}</div>
                <div class="stat-label">可疑流量</div>
                <div class="stat-percent">${summary.suspiciousCount > 0 ? ((summary.suspiciousCount / summary.totalRecords) * 100).toFixed(1) : 0}%</div>
            </div>
            <div class="stat-card clean">
                <div class="stat-value" style="color: #10b981;">${summary.cleanCount.toLocaleString()}</div>
                <div class="stat-label">正常流量</div>
                <div class="stat-percent">${summary.cleanCount > 0 ? ((summary.cleanCount / summary.totalRecords) * 100).toFixed(1) : 0}%</div>
            </div>
            <div class="stat-card total">
                <div class="stat-value" style="color: #3b82f6;">${summary.totalRecords.toLocaleString()}</div>
                <div class="stat-label">总记录数</div>
            </div>
        </div>

        <div class="section">
            <h2>🏆 热门机器人 IP (Top 10)</h2>
            <table>
                <thead>
                    <tr>
                        <th>IP 地址</th>
                        <th>总请求数</th>
                        <th>机器人请求</th>
                        <th>占比</th>
                    </tr>
                </thead>
                <tbody>
                    ${reportData.topBotIPs.slice(0, 10).map(item => `
                    <tr>
                        <td><code>${item.ip}</code></td>
                        <td>${item.count.toLocaleString()}</td>
                        <td><span class="badge bot">${item.botCount.toLocaleString()}</span></td>
                        <td>${((item.botCount / item.count) * 100).toFixed(1)}%</td>
                    </tr>
                    `).join('')}
                    ${reportData.topBotIPs.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: #9ca3af;">无数据</td></tr>' : ''}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>🎯 匹配规则统计</h2>
            <table>
                <thead>
                    <tr>
                        <th>规则名称</th>
                        <th>匹配次数</th>
                        <th>占比</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(reportData.matchedRules)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 15)
                        .map(([rule, count]) => `
                    <tr>
                        <td>${rule}</td>
                        <td>${count.toLocaleString()}</td>
                        <td>${((count / summary.totalRecords) * 100).toFixed(1)}%</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>📈 评分分布</h2>
            <table>
                <thead>
                    <tr>
                        <th>评分区间</th>
                        <th>数量</th>
                        <th>占比</th>
                        <th>分类</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(reportData.scoring).map(([range, count]) => {
                        let badgeClass = 'clean';
                        if (parseInt(range) >= 40) badgeClass = 'bot';
                        else if (parseInt(range) >= 20) badgeClass = 'suspicious';
                        const label = parseInt(range) >= 40 ? '机器人' : parseInt(range) >= 20 ? '可疑' : '正常';
                        return `
                    <tr>
                        <td>${range}</td>
                        <td>${count.toLocaleString()}</td>
                        <td>${summary.totalRecords > 0 ? ((count / summary.totalRecords) * 100).toFixed(1) : 0}%</td>
                        <td><span class="badge ${badgeClass}">${label}</span></td>
                    </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>🤖 可疑 User-Agent (Top 10)</h2>
            <table>
                <thead>
                    <tr>
                        <th>User-Agent</th>
                        <th>总请求</th>
                        <th>机器人请求</th>
                    </tr>
                </thead>
                <tbody>
                    ${reportData.topBotUAs.slice(0, 10).map(item => `
                    <tr>
                        <td><div class="ua-preview" title="${item.userAgent}">${item.userAgent}</div></td>
                        <td>${item.count.toLocaleString()}</td>
                        <td><span class="badge bot">${item.botCount.toLocaleString()}</span></td>
                    </tr>
                    `).join('')}
                    ${reportData.topBotUAs.length === 0 ? '<tr><td colspan="3" style="text-align: center; color: #9ca3af;">无数据</td></tr>' : ''}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>🚨 可疑路径 (Top 10)</h2>
            <table>
                <thead>
                    <tr>
                        <th>路径</th>
                        <th>总请求</th>
                        <th>机器人请求</th>
                    </tr>
                </thead>
                <tbody>
                    ${reportData.topSuspiciousPaths.slice(0, 10).map(item => `
                    <tr>
                        <td><code>${item.path}</code></td>
                        <td>${item.count.toLocaleString()}</td>
                        <td><span class="badge bot">${item.botCount.toLocaleString()}</span></td>
                    </tr>
                    `).join('')}
                    ${reportData.topSuspiciousPaths.length === 0 ? '<tr><td colspan="3" style="text-align: center; color: #9ca3af;">无数据</td></tr>' : ''}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p>本报告由 bot-filter 工具生成 | 样本数据已保存至 samples/ 目录</p>
        </div>
    </div>
</body>
</html>`;
}

module.exports = {
  generateReports
};
