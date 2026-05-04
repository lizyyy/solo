const DataAnalyzer = require('./dataAnalyzer');
const { ERROR_TYPE_NAMES, MARK_TYPE_NAMES } = require('../models');

class ReportExporter {
  constructor(projectData, annotations = {}) {
    this.project = projectData;
    this.annotations = annotations;
    this.analyzer = new DataAnalyzer(projectData.data);
  }

  generateReport(filters = {}) {
    const summary = this.analyzer.getSummary(filters);
    const sectionHeatmap = this.analyzer.getSectionHeatmap(filters);
    const musicianRanking = this.analyzer.getMusicianRanking(filters);
    const trendData = this.analyzer.getTrendData(filters);
    const songAnalysis = this.analyzer.getSongAnalysis(filters);
    const practiceList = this.analyzer.generatePracticeList(filters);
    const availableFilters = this.analyzer.getAvailableFilters();

    return {
      project: {
        id: this.project.id,
        name: this.project.name,
        createdAt: this.project.createdAt,
        updatedAt: this.project.updatedAt
      },
      generatedAt: new Date().toISOString(),
      filters,
      summary,
      sectionHeatmap,
      musicianRanking,
      trendData,
      songAnalysis,
      practiceList: practiceList.slice(0, 15),
      availableFilters,
      annotations: {
        markers: this.annotations.markers || {},
        notes: this.annotations.notes || {}
      }
    };
  }

  exportJSON(filters = {}) {
    return JSON.stringify(this.generateReport(filters), null, 2);
  }

  exportCSV(filters = {}) {
    const report = this.generateReport(filters);
    const lines = [];

    lines.push('=== 排练复盘报告 ===');
    lines.push(`项目: ${report.project.name}`);
    lines.push(`生成时间: ${new Date(report.generatedAt).toLocaleString()}`);
    lines.push('');

    lines.push('=== 摘要 ===');
    lines.push('指标,数值');
    lines.push(`总错误数,${report.summary.totalErrors}`);
    lines.push(`音准问题,${report.summary.pitchErrors}`);
    lines.push(`节奏问题,${report.summary.beatErrors}`);
    lines.push(`平均音高偏差,${report.summary.avgPitchCents} cents`);
    lines.push(`平均节拍偏差,${report.summary.avgBeatMs} ms`);
    lines.push(`严重音准问题,${report.summary.severePitchErrors}`);
    lines.push(`严重节奏问题,${report.summary.severeBeatErrors}`);
    lines.push('');

    lines.push('=== 段落问题分布 ===');
    lines.push('段落,错误数,占比');
    report.sectionHeatmap.forEach(item => {
      lines.push(`${item.section},${item.count},${item.percentage}%`);
    });
    lines.push('');

    lines.push('=== 成员问题排行 ===');
    lines.push('成员,总错误,音准问题,节奏问题,平均音准偏差,平均节拍偏差');
    report.musicianRanking.forEach(m => {
      lines.push(`${m.musician},${m.totalErrors},${m.pitchErrors},${m.beatErrors},${m.avgPitchCents},${m.avgBeatMs}`);
    });
    lines.push('');

    lines.push('=== 练习清单 ===');
    lines.push('优先级,歌曲,段落,主要问题,主要成员,建议');
    const severityMap = { critical: '紧急', high: '高', medium: '中', low: '低' };
    report.practiceList.forEach((item, idx) => {
      const suggestion = item.suggestions.length > 0 ? item.suggestions[0].text : '';
      lines.push(`${severityMap[item.severity] || item.severity},${item.songName},${item.section},${item.primaryError.name},${item.primaryMusician || ''},"${suggestion}"`);
    });

    return lines.join('\n');
  }

  exportMarkdown(filters = {}) {
    const report = this.generateReport(filters);
    const lines = [];

    lines.push('# 乐队排练复盘报告');
    lines.push('');
    lines.push(`**项目**: ${report.project.name}`);
    lines.push(`**生成时间**: ${new Date(report.generatedAt).toLocaleString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## 一、摘要统计');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总错误数 | ${report.summary.totalErrors} |`);
    lines.push(`| 音准问题 | ${report.summary.pitchErrors} |`);
    lines.push(`| 节奏问题 | ${report.summary.beatErrors} |`);
    lines.push(`| 平均音高偏差 | ${report.summary.avgPitchCents} cents |`);
    lines.push(`| 平均节拍偏差 | ${report.summary.avgBeatMs} ms |`);
    lines.push(`| 严重音准问题 | ${report.summary.severePitchErrors} |`);
    lines.push(`| 严重节奏问题 | ${report.summary.severeBeatErrors} |`);
    lines.push('');

    lines.push('## 二、段落问题分布');
    lines.push('');
    lines.push('| 段落 | 错误数 | 占比 |');
    lines.push('|------|--------|------|');
    report.sectionHeatmap.forEach(item => {
      lines.push(`| ${item.section} | ${item.count} | ${item.percentage}% |`);
    });
    lines.push('');

    lines.push('## 三、成员问题排行');
    lines.push('');
    lines.push('| 排名 | 成员 | 总错误 | 音准 | 节奏 | 音准偏差(平均) | 节拍偏差(平均) | 乐器 |');
    lines.push('|------|------|--------|------|------|----------------|----------------|------|');
    report.musicianRanking.forEach((m, idx) => {
      const instruments = m.instruments.join(', ');
      lines.push(`| ${idx + 1} | ${m.musician} | ${m.totalErrors} | ${m.pitchErrors} | ${m.beatErrors} | ${m.avgPitchCents} | ${m.avgBeatMs} | ${instruments} |`);
    });
    lines.push('');

    lines.push('## 四、趋势分析');
    lines.push('');
    if (report.trendData.length > 1) {
      lines.push('| 场次 | 日期 | 总错误 | 音准问题 | 节奏问题 |');
      lines.push('|------|------|--------|----------|----------|');
      report.trendData.forEach(t => {
        lines.push(`| ${t.sessionId} | ${t.date} | ${t.totalErrors} | ${t.pitchErrors} | ${t.beatErrors} |`);
      });
    } else {
      lines.push('> 需要至少两次排练数据才能进行趋势对比。');
    }
    lines.push('');

    lines.push('## 五、歌曲问题分析');
    lines.push('');
    report.songAnalysis.forEach(song => {
      lines.push(`### ${song.songName}`);
      lines.push(`- 总错误数: ${song.totalErrors}`);
      lines.push(`- 问题段落: ${Object.entries(song.sections).map(([k, v]) => `${k}(${v})`).join(', ')}`);
      lines.push(`- 问题成员: ${Object.entries(song.musicians).map(([k, v]) => `${k}(${v})`).join(', ')}`);
      lines.push('');
    });

    lines.push('## 六、下次排练练习清单');
    lines.push('');
    const severityMap = { critical: '🔴 紧急', high: '🟠 高', medium: '🟡 中', low: '🟢 低' };
    
    report.practiceList.forEach((item, idx) => {
      lines.push(`### ${idx + 1}. ${item.songName} - ${item.section}`);
      lines.push(`- **优先级**: ${severityMap[item.severity] || item.severity}`);
      lines.push(`- **主要问题**: ${item.primaryError.name} (${item.count} 次)`);
      if (item.primaryMusician) {
        lines.push(`- **主要成员**: ${item.primaryMusician}`);
      }
      lines.push('- **建议练习方法**:');
      item.suggestions.forEach(s => {
        lines.push(`  - ${s.text}`);
      });
      lines.push('');
    });

    if (Object.keys(report.annotations.markers).length > 0 || Object.keys(report.annotations.notes).length > 0) {
      lines.push('## 七、标记和备注');
      lines.push('');
      
      if (Object.keys(report.annotations.markers).length > 0) {
        lines.push('### 标记');
        lines.push('');
        Object.entries(report.annotations.markers).forEach(([itemId, marker]) => {
          lines.push(`- ${itemId}: ${MARK_TYPE_NAMES[marker.type] || marker.type}`);
        });
        lines.push('');
      }
      
      if (Object.keys(report.annotations.notes).length > 0) {
        lines.push('### 备注');
        lines.push('');
        Object.entries(report.annotations.notes).forEach(([itemId, note]) => {
          lines.push(`- **${itemId}**: ${note.text}`);
        });
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
    lines.push('> 此报告由 Band Rehearsal Review 工具自动生成');

    return lines.join('\n');
  }

  exportHTML(filters = {}) {
    const report = this.generateReport(filters);
    
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>排练复盘报告 - ${report.project.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 3px solid #4f46e5; padding-bottom: 10px; margin-bottom: 20px; }
    h2 { color: #1a1a1a; margin-top: 30px; margin-bottom: 15px; padding-left: 10px; border-left: 4px solid #4f46e5; }
    h3 { color: #374151; margin-top: 20px; margin-bottom: 10px; }
    .meta { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .meta p { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    tr:hover { background: #f9fafb; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; }
    .summary-card .value { font-size: 32px; font-weight: bold; }
    .summary-card .label { font-size: 14px; opacity: 0.9; }
    .heatmap { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 20px 0; }
    .heatmap-item { padding: 15px; border-radius: 8px; text-align: center; }
    .heatmap-item .section { font-weight: bold; font-size: 14px; }
    .heatmap-item .count { font-size: 24px; font-weight: bold; }
    .severity-critical { background: #fee2e2; border-left: 4px solid #ef4444; }
    .severity-high { background: #fef3c7; border-left: 4px solid #f59e0b; }
    .severity-medium { background: #fef9c3; border-left: 4px solid #eab308; }
    .severity-low { background: #dcfce7; border-left: 4px solid #22c55e; }
    .practice-item { padding: 15px; margin: 10px 0; border-radius: 8px; }
    .practice-item h4 { margin-bottom: 10px; }
    .suggestions { margin-top: 10px; padding-left: 20px; }
    .suggestions li { margin: 5px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <h1>🎸 乐队排练复盘报告</h1>
  
  <div class="meta">
    <p><strong>项目:</strong> ${report.project.name}</p>
    <p><strong>生成时间:</strong> ${new Date(report.generatedAt).toLocaleString()}</p>
  </div>

  <h2>一、摘要统计</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="value">${report.summary.totalErrors}</div>
      <div class="label">总错误数</div>
    </div>
    <div class="summary-card">
      <div class="value">${report.summary.pitchErrors}</div>
      <div class="label">音准问题</div>
    </div>
    <div class="summary-card">
      <div class="value">${report.summary.beatErrors}</div>
      <div class="label">节奏问题</div>
    </div>
    <div class="summary-card">
      <div class="value">${report.summary.avgPitchCents}</div>
      <div class="label">平均音高偏差 (cents)</div>
    </div>
    <div class="summary-card">
      <div class="value">${report.summary.avgBeatMs}</div>
      <div class="label">平均节拍偏差 (ms)</div>
    </div>
    <div class="summary-card">
      <div class="value">${report.summary.severeTotal}</div>
      <div class="label">严重问题数</div>
    </div>
  </div>

  <h2>二、段落问题分布</h2>
  <div class="heatmap">
    ${report.sectionHeatmap.map(item => {
      const intensity = item.intensity;
      const r = Math.round(255 - intensity * 100);
      const g = Math.round(255 - intensity * 150);
      const b = 255;
      return `
    <div class="heatmap-item" style="background: rgb(${r}, ${g}, ${b});">
      <div class="section">${item.section}</div>
      <div class="count">${item.count}</div>
      <div>${item.percentage}%</div>
    </div>`;
    }).join('')}
  </div>

  <h2>三、成员问题排行</h2>
  <table>
    <thead>
      <tr><th>排名</th><th>成员</th><th>总错误</th><th>音准</th><th>节奏</th><th>音准偏差</th><th>节拍偏差</th><th>乐器</th></tr>
    </thead>
    <tbody>
      ${report.musicianRanking.map((m, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${m.musician}</strong></td>
        <td>${m.totalErrors}</td>
        <td>${m.pitchErrors}</td>
        <td>${m.beatErrors}</td>
        <td>${m.avgPitchCents} cents</td>
        <td>${m.avgBeatMs} ms</td>
        <td>${m.instruments.join(', ')}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  ${report.trendData.length > 1 ? `
  <h2>四、趋势分析</h2>
  <table>
    <thead>
      <tr><th>场次</th><th>日期</th><th>总错误</th><th>音准问题</th><th>节奏问题</th></tr>
    </thead>
    <tbody>
      ${report.trendData.map(t => `
      <tr>
        <td>${t.sessionId}</td>
        <td>${t.date}</td>
        <td>${t.totalErrors}</td>
        <td>${t.pitchErrors}</td>
        <td>${t.beatErrors}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  ` : ''}

  <h2>五、下次排练练习清单</h2>
  ${(() => {
    const severityClasses = { critical: 'severity-critical', high: 'severity-high', medium: 'severity-medium', low: 'severity-low' };
    const severityLabels = { critical: '🔴 紧急', high: '🟠 高', medium: '🟡 中', low: '🟢 低' };
    return report.practiceList.map((item, idx) => `
  <div class="practice-item ${severityClasses[item.severity] || ''}">
    <h4>${idx + 1}. ${item.songName} - ${item.section}</h4>
    <p><strong>优先级:</strong> ${severityLabels[item.severity] || item.severity}</p>
    <p><strong>主要问题:</strong> ${item.primaryError.name} (${item.count} 次)</p>
    ${item.primaryMusician ? `<p><strong>主要成员:</strong> ${item.primaryMusician}</p>` : ''}
    <div class="suggestions">
      <p><strong>建议练习方法:</strong></p>
      <ul>
        ${item.suggestions.map(s => `<li>${s.text}</li>`).join('')}
      </ul>
    </div>
  </div>`).join('');
  })()}

  <div class="footer">
    <p>此报告由 Band Rehearsal Review 工具自动生成</p>
    <p>生成时间: ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`;

    return html;
  }
}

module.exports = ReportExporter;
