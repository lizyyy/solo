const ReportExporter = {
  generateReportData() {
    const sessionData = TimelineManager.getSessionData();
    const riskSummary = RiskDetector.getRiskSummary();
    
    return {
      version: '1.0',
      generatedAt: Date.now(),
      generatedAtFormatted: Utils.formatTimeMs(Date.now()),
      
      session: {
        startTime: sessionData.messages.length > 0 
          ? sessionData.messages[0].sentAt 
          : null,
        endTime: sessionData.messages.length > 0 
          ? sessionData.messages[sessionData.messages.length - 1].receivedAt || 
            sessionData.messages[sessionData.messages.length - 1].sentAt 
          : null,
        totalMessages: sessionData.stats.total
      },
      
      weaknet: {
        enabled: sessionData.weaknetEnabled,
        config: sessionData.weaknetConfig,
        profile: this.detectProfile(sessionData.weaknetConfig)
      },
      
      statistics: {
        total: sessionData.stats.total,
        success: sessionData.stats.success,
        slow: sessionData.stats.slow,
        lost: sessionData.stats.lost,
        outOfOrder: sessionData.stats.outOfOrder,
        duplicate: sessionData.stats.duplicate,
        replayed: sessionData.stats.replayed,
        
        latency: {
          average: sessionData.latencyStats.avg,
          maximum: sessionData.latencyStats.max,
          minimum: sessionData.latencyStats.min === Infinity ? 0 : sessionData.latencyStats.min,
          samples: sessionData.latencyStats.values.length
        },
        
        successRate: sessionData.stats.total > 0 
          ? ((sessionData.stats.success / sessionData.stats.total) * 100).toFixed(1)
          : 0,
        lossRate: sessionData.stats.total > 0 
          ? ((sessionData.stats.lost / sessionData.stats.total) * 100).toFixed(1)
          : 0
      },
      
      risks: {
        total: riskSummary.total,
        critical: riskSummary.critical,
        warnings: riskSummary.warnings,
        list: riskSummary.list
      },
      
      messages: sessionData.messages.slice(-100),
      
      replaySummary: this.generateReplaySummary(sessionData.messages)
    };
  },

  detectProfile(config) {
    for (const [name, profile] of Object.entries(WEAKNET_PROFILES)) {
      if (name === 'custom') continue;
      
      if (config.latency === profile.latency &&
          config.jitter === profile.jitter &&
          config.loss === profile.loss) {
        return { name: profile.name, key: name };
      }
    }
    return { name: '自定义', key: 'custom' };
  },

  generateReplaySummary(messages) {
    if (messages.length === 0) {
      return { hasData: false };
    }

    const typeCounts = {};
    messages.forEach(msg => {
      typeCounts[msg.type] = (typeCounts[msg.type] || 0) + 1;
    });

    const slowMessages = messages.filter(m => m.statusTags.includes('slow'));
    const lostMessages = messages.filter(m => m.statusTags.includes('lost'));
    const oooMessages = messages.filter(m => m.statusTags.includes('outoforder'));
    const dupMessages = messages.filter(m => m.statusTags.includes('duplicate'));
    const replayedMessages = messages.filter(m => m.statusTags.includes('replayed'));

    return {
      hasData: true,
      typeDistribution: typeCounts,
      issues: {
        slow: slowMessages.length,
        lost: lostMessages.length,
        outOfOrder: oooMessages.length,
        duplicate: dupMessages.length,
        replayed: replayedMessages.length
      },
      sampleMessages: messages.slice(0, 5).map(m => ({
        seq: m.seq,
        type: m.type,
        status: m.status,
        latency: m.receivedAt ? m.receivedAt - m.sentAt : null
      }))
    };
  },

  exportJSON() {
    const report = this.generateReportData();
    const json = JSON.stringify(report, null, 2);
    const filename = `webrtc-report-${Date.now()}.json`;
    Utils.downloadFile(json, filename, 'application/json');
    Utils.showToast('JSON 报告已导出', 'success');
  },

  exportMarkdown() {
    const report = this.generateReportData();
    const md = this.generateMarkdownReport(report);
    const filename = `webrtc-report-${Date.now()}.md`;
    Utils.downloadFile(md, filename, 'text/markdown');
    Utils.showToast('Markdown 报告已导出', 'success');
  },

  exportHTML() {
    const report = this.generateReportData();
    const html = this.generateHTMLReport(report);
    const filename = `webrtc-report-${Date.now()}.html`;
    Utils.downloadFile(html, filename, 'text/html');
    Utils.showToast('HTML 报告已导出', 'success');
  },

  generateMarkdownReport(report) {
    const lines = [];
    
    lines.push(`# WebRTC 弱网协作测试报告`);
    lines.push(``);
    lines.push(`> 生成时间: ${report.generatedAtFormatted}`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
    
    lines.push(`## 1. 会话概览`);
    lines.push(``);
    lines.push(`| 项目 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 消息总数 | ${report.statistics.total} |`);
    lines.push(`| 成功消息 | ${report.statistics.success} |`);
    lines.push(`| 成功率 | ${report.statistics.successRate}% |`);
    lines.push(`| 丢包数 | ${report.statistics.lost} |`);
    lines.push(`| 丢包率 | ${report.statistics.lossRate}% |`);
    lines.push(``);
    
    lines.push(`## 2. 弱网配置`);
    lines.push(``);
    if (report.weaknet.enabled) {
      lines.push(`**Profile:** ${report.weaknet.profile.name}`);
      lines.push(``);
      lines.push(`| 参数 | 值 |`);
      lines.push(`|------|-----|`);
      lines.push(`| 延迟 | ${report.weaknet.config.latency}ms |`);
      lines.push(`| 抖动 | ${report.weaknet.config.jitter}ms |`);
      lines.push(`| 丢包率 | ${report.weaknet.config.loss}% |`);
      lines.push(`| 乱序率 | ${report.weaknet.config.reorder}% |`);
      lines.push(`| 重复率 | ${report.weaknet.config.duplicate}% |`);
      lines.push(`| 断线概率 | ${report.weaknet.config.disconnect}% |`);
    } else {
      lines.push(`弱网模拟已关闭`);
    }
    lines.push(``);
    
    lines.push(`## 3. 延迟统计`);
    lines.push(``);
    lines.push(`| 指标 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 平均延迟 | ${report.statistics.latency.average}ms |`);
    lines.push(`| 最大延迟 | ${report.statistics.latency.maximum}ms |`);
    lines.push(`| 最小延迟 | ${report.statistics.latency.minimum}ms |`);
    lines.push(`| 样本数 | ${report.statistics.latency.samples} |`);
    lines.push(``);
    
    lines.push(`## 4. 问题统计`);
    lines.push(``);
    lines.push(`| 类型 | 数量 |`);
    lines.push(`|------|------|`);
    lines.push(`| 慢包 | ${report.statistics.slow} |`);
    lines.push(`| 丢包 | ${report.statistics.lost} |`);
    lines.push(`| 乱序 | ${report.statistics.outOfOrder} |`);
    lines.push(`| 重复 | ${report.statistics.duplicate} |`);
    lines.push(`| 重放 | ${report.statistics.replayed} |`);
    lines.push(``);
    
    lines.push(`## 5. 风险提示`);
    lines.push(``);
    if (report.risks.total > 0) {
      lines.push(`**严重风险:** ${report.risks.critical} 个`);
      lines.push(``);
      lines.push(`**警告:** ${report.risks.warnings} 个`);
      lines.push(``);
      
      if (report.risks.list.length > 0) {
        lines.push(`### 风险详情`);
        lines.push(``);
        report.risks.list.forEach((risk, i) => {
          const level = risk.level === 'critical' ? '🔴 严重' : '🟡 警告';
          lines.push(`${i + 1}. **${level}**: ${risk.message}`);
          lines.push(`   - 时间: ${Utils.formatTimeMs(risk.timestamp)}`);
          lines.push(``);
        });
      }
    } else {
      lines.push(`✅ 无风险提示`);
    }
    lines.push(``);
    
    if (report.replaySummary.hasData) {
      lines.push(`## 6. 消息类型分布`);
      lines.push(``);
      
      const typeNames = {
        cursor: '光标位置',
        annotation: '批注',
        stroke: '白板笔画',
        patch: '文档 Patch',
        text: '文本消息'
      };
      
      Object.entries(report.replaySummary.typeDistribution).forEach(([type, count]) => {
        const name = typeNames[type] || type;
        lines.push(`- ${name}: ${count} 条`);
      });
    }
    
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
    lines.push(`*报告由 WebRTC 弱网协作预演台生成*`);
    
    return lines.join('\n');
  },

  generateHTMLReport(report) {
    const getStatusColor = (count) => {
      if (count === 0) return 'success';
      if (count < 5) return 'warning';
      return 'danger';
    };

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebRTC 弱网协作测试报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f9fafb;
    }
    h1 { font-size: 28px; margin-bottom: 8px; color: #111827; }
    h2 { font-size: 20px; margin: 32px 0 16px; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    h3 { font-size: 16px; margin: 20px 0 12px; color: #374151; }
    .meta { color: #6b7280; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-weight: 600; }
    tr:hover { background: #f9fafb; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-info { background: #dbeafe; color: #1e40af; }
    .risk-item { padding: 16px; margin: 8px 0; border-radius: 8px; }
    .risk-critical { background: #fef2f2; border-left: 4px solid #ef4444; }
    .risk-warning { background: #fffbeb; border-left: 4px solid #f59e0b; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 16px 0; }
    .stat-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-label { font-size: 14px; color: #6b7280; margin-bottom: 4px; }
    .stat-value { font-size: 28px; font-weight: 700; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; text-align: center; }
    ul { padding-left: 24px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <h1>WebRTC 弱网协作测试报告</h1>
  <p class="meta">生成时间: ${report.generatedAtFormatted}</p>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">消息总数</div>
      <div class="stat-value">${report.statistics.total}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">成功率</div>
      <div class="stat-value">${report.statistics.successRate}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">平均延迟</div>
      <div class="stat-value">${report.statistics.latency.average}ms</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">丢包率</div>
      <div class="stat-value">${report.statistics.lossRate}%</div>
    </div>
  </div>

  <h2>1. 弱网配置</h2>
  ${report.weaknet.enabled ? `
  <p><strong>Profile:</strong> ${report.weaknet.profile.name}</p>
  <table>
    <thead><tr><th>参数</th><th>值</th></tr></thead>
    <tbody>
      <tr><td>延迟</td><td><span class="badge badge-info">${report.weaknet.config.latency}ms</span></td></tr>
      <tr><td>抖动</td><td><span class="badge badge-info">${report.weaknet.config.jitter}ms</span></td></tr>
      <tr><td>丢包率</td><td><span class="badge badge-${report.weaknet.config.loss > 5 ? 'warning' : 'info'}">${report.weaknet.config.loss}%</span></td></tr>
      <tr><td>乱序率</td><td><span class="badge badge-info">${report.weaknet.config.reorder}%</span></td></tr>
      <tr><td>重复率</td><td><span class="badge badge-info">${report.weaknet.config.duplicate}%</span></td></tr>
      <tr><td>断线概率</td><td><span class="badge badge-${report.weaknet.config.disconnect > 0 ? 'warning' : 'info'}">${report.weaknet.config.disconnect}%</span></td></tr>
    </tbody>
  </table>
  ` : `
  <p>弱网模拟已关闭</p>
  `}

  <h2>2. 延迟统计</h2>
  <table>
    <thead><tr><th>指标</th><th>值</th></tr></thead>
    <tbody>
      <tr><td>平均延迟</td><td>${report.statistics.latency.average}ms</td></tr>
      <tr><td>最大延迟</td><td><span class="badge badge-${report.statistics.latency.maximum > 500 ? 'danger' : report.statistics.latency.maximum > 200 ? 'warning' : 'success'}">${report.statistics.latency.maximum}ms</span></td></tr>
      <tr><td>最小延迟</td><td>${report.statistics.latency.minimum}ms</td></tr>
      <tr><td>样本数</td><td>${report.statistics.latency.samples}</td></tr>
    </tbody>
  </table>

  <h2>3. 问题统计</h2>
  <table>
    <thead><tr><th>类型</th><th>数量</th><th>状态</th></tr></thead>
    <tbody>
      <tr>
        <td>慢包</td>
        <td>${report.statistics.slow}</td>
        <td><span class="badge badge-${getStatusColor(report.statistics.slow)}">${report.statistics.slow > 0 ? '存在' : '正常'}</span></td>
      </tr>
      <tr>
        <td>丢包</td>
        <td>${report.statistics.lost}</td>
        <td><span class="badge badge-${getStatusColor(report.statistics.lost)}">${report.statistics.lost > 0 ? '存在' : '正常'}</span></td>
      </tr>
      <tr>
        <td>乱序</td>
        <td>${report.statistics.outOfOrder}</td>
        <td><span class="badge badge-${getStatusColor(report.statistics.outOfOrder)}">${report.statistics.outOfOrder > 0 ? '存在' : '正常'}</span></td>
      </tr>
      <tr>
        <td>重复</td>
        <td>${report.statistics.duplicate}</td>
        <td><span class="badge badge-${getStatusColor(report.statistics.duplicate)}">${report.statistics.duplicate > 0 ? '存在' : '正常'}</span></td>
      </tr>
      <tr>
        <td>重放</td>
        <td>${report.statistics.replayed}</td>
        <td><span class="badge badge-info">${report.statistics.replayed > 0 ? '已重放' : '无'}</span></td>
      </tr>
    </tbody>
  </table>

  <h2>4. 风险提示</h2>
  ${report.risks.total > 0 ? `
  <p><strong>严重风险:</strong> <span class="badge badge-danger">${report.risks.critical}</span></p>
  <p><strong>警告:</strong> <span class="badge badge-warning">${report.risks.warnings}</span></p>
  
  <h3>风险详情</h3>
  ${report.risks.list.map(risk => `
    <div class="risk-item risk-${risk.level}">
      <strong>${risk.level === 'critical' ? '🔴 严重' : '🟡 警告'}</strong>
      <p style="margin-top: 8px;">${risk.message}</p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">时间: ${Utils.formatTimeMs(risk.timestamp)}</p>
    </div>
  `).join('')}
  ` : `
  <p><span class="badge badge-success">✅ 无风险提示</span></p>
  `}

  ${report.replaySummary.hasData ? `
  <h2>5. 消息类型分布</h2>
  <ul>
  ${(() => {
    const typeNames = {
      cursor: '光标位置',
      annotation: '批注',
      stroke: '白板笔画',
      patch: '文档 Patch',
      text: '文本消息'
    };
    return Object.entries(report.replaySummary.typeDistribution).map(([type, count]) => {
      const name = typeNames[type] || type;
      return `<li><strong>${name}:</strong> ${count} 条</li>`;
    }).join('');
  })()}
  </ul>
  ` : ''}

  <div class="footer">
    报告由 WebRTC 弱网协作预演台生成
  </div>
</body>
</html>`;
  },

  saveSession() {
    const sessionData = TimelineManager.getSessionData();
    const json = JSON.stringify(sessionData, null, 2);
    const filename = `webrtc-session-${Date.now()}.json`;
    Utils.downloadFile(json, filename, 'application/json');
    Utils.showToast('会话已保存', 'success');
  },

  async loadSession(file) {
    try {
      const text = await Utils.readFileAsText(file);
      const data = JSON.parse(text);
      
      TimelineManager.loadSessionData(data);
      
      if (data.weaknetConfig) {
        weakNet.setConfig(data.weaknetConfig);
      }
      if (data.weaknetEnabled !== undefined) {
        weakNet.setEnabled(data.weaknetEnabled);
      }
      
      Utils.showToast('会话已加载', 'success');
      return true;
    } catch (e) {
      Utils.showToast(`加载失败: ${e.message}`, 'error');
      return false;
    }
  }
};
