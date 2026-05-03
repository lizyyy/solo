import moment from 'moment';
import { formatDate } from '../utils/date.js';
import { getSurfaceName, getTrainingTypeName } from '../utils/normalization.js';

export class ReportGenerator {
  constructor(options = {}) {
    this.referenceDate = options.referenceDate || moment();
  }

  generateMarkdown(analysis, validation) {
    const { risk, shoes, soreness, aggregator } = analysis;
    const { runs, shoes: shoesValidation, soreness: sorenessValidation } = validation;
    
    let md = `# 跑步训练负荷分析报告\n\n`;
    md += `生成时间: ${formatDate(this.referenceDate)} ${this.referenceDate.format('HH:mm')}\n\n`;
    
    md += `## 摘要概览\n\n`;
    
    const overallLevel = risk.summary.overallLevel;
    const levelEmoji = overallLevel === 'danger' ? '🔴' : (overallLevel === 'warning' ? '🟡' : '🟢');
    md += `**风险状态:** ${levelEmoji} ${this.getLevelText(overallLevel)}\n\n`;
    md += `- 风险项: ${risk.summary.riskCount} 个\n`;
    md += `- 警告项: ${risk.summary.warningCount} 个\n`;
    md += `- 跑鞋需关注: ${shoes.stats.shoesNeedingAttention} 双\n`;
    if (soreness.summary.recentRecords > 0) {
      md += `- 近期疼痛记录: ${soreness.summary.recentRecords} 条\n`;
    }
    md += '\n';
    
    if (risk.risks.length > 0 || risk.warnings.length > 0) {
      md += `## 训练风险分析\n\n`;
      
      if (risk.risks.length > 0) {
        md += `### 🔴 高风险\n\n`;
        for (const r of risk.risks) {
          md += `- **[${r.category}]** ${r.message}\n`;
        }
        md += '\n';
      }
      
      if (risk.warnings.length > 0) {
        md += `### 🟡 中风险/警告\n\n`;
        for (const w of risk.warnings) {
          md += `- **[${w.category}]** ${w.message}\n`;
        }
        md += '\n';
      }
      
      if (risk.acwr.acwr !== null) {
        md += `### 急慢比 (ACWR) 详情\n\n`;
        md += `- 急慢比: ${risk.acwr.acwr.toFixed(2)}\n`;
        md += `- 近7天负荷: ${risk.acwr.acuteWorkload.toFixed(1)} (距离: ${risk.acwr.acuteDistance.toFixed(1)} km)\n`;
        md += `- 近28天周均负荷: ${risk.acwr.chronicAvgWorkload.toFixed(1)} (周均距离: ${risk.acwr.chronicAvgDistance.toFixed(1)} km)\n`;
        md += `- 状态: ${risk.acwr.message}\n\n`;
      }
    }
    
    if (shoes.stats.totalShoes > 0) {
      md += `## 跑鞋状态分析\n\n`;
      
      if (shoes.alerts.length > 0) {
        md += `### 🔴 需要立即关注\n\n`;
        for (const alert of shoes.alerts) {
          md += `- **[${alert.shoe}]** ${alert.message}\n`;
        }
        md += '\n';
      }
      
      if (shoes.warnings.length > 0) {
        md += `### 🟡 需要注意\n\n`;
        for (const warning of shoes.warnings) {
          md += `- **[${warning.shoe}]** ${warning.message}\n`;
        }
        md += '\n';
      }
      
      if (shoes.rotationSuggestions.hasSuggestions) {
        md += `### 轮换建议\n\n`;
        for (const s of shoes.rotationSuggestions.suggestions) {
          md += `- ${s.message}\n`;
        }
        for (const w of shoes.rotationSuggestions.warnings) {
          md += `- ${w.message}\n`;
        }
        md += '\n';
      }
      
      md += `### 跑鞋详情\n\n`;
      md += `| 鞋款 | 累计里程 | 状态 | 最后使用 | 剩余里程 |\n`;
      md += `|------|----------|------|----------|----------|\n`;
      for (const shoe of shoes.shoeStats) {
        const statusEmoji = shoe.overallStatus === 'danger' ? '🔴' : (shoe.overallStatus === 'warning' ? '🟡' : '🟢');
        md += `| ${shoe.name} | ${shoe.totalDistance.toFixed(1)} km | ${statusEmoji} ${shoe.mileageMessage} | ${shoe.lastRunStr || '-'} | ${shoe.remainingMileage > 0 ? shoe.remainingMileage.toFixed(1) + ' km' : '-'} |\n`;
      }
      md += '\n';
    }
    
    if (soreness.summary.totalSorenessRecords > 0) {
      md += `## 疼痛关联分析\n\n`;
      
      md += `### 疼痛部位统计\n\n`;
      md += `| 部位 | 次数 | 平均严重程度 |\n`;
      md += `|------|------|--------------|\n`;
      for (const loc of soreness.locationStats) {
        md += `| ${loc.location} | ${loc.count} | ${loc.avgSeverity.toFixed(1)}/10 |\n`;
      }
      md += '\n';
      
      if (soreness.patterns.hasPatterns) {
        md += `### 发现的关联模式\n\n`;
        
        if (soreness.patterns.highRiskShoes.length > 0) {
          md += `#### 鞋款关联\n\n`;
          for (const s of soreness.patterns.highRiskShoes) {
            md += `- **${s.shoe}**: ${s.message}\n`;
          }
          md += '\n';
        }
        
        if (soreness.patterns.highRiskSurfaces.length > 0) {
          md += `#### 路面关联\n\n`;
          for (const s of soreness.patterns.highRiskSurfaces) {
            md += `- **${s.surfaceName}**: ${s.message}\n`;
          }
          md += '\n';
        }
        
        if (soreness.patterns.highRiskTypes.length > 0) {
          md += `#### 训练类型关联\n\n`;
          for (const t of soreness.patterns.highRiskTypes) {
            md += `- **${t.typeName}**: ${t.message}\n`;
          }
          md += '\n';
        }
      }
      
      if (soreness.recentSoreness.length > 0) {
        md += `### 近期疼痛记录 (最近14天)\n\n`;
        for (const pain of soreness.recentSoreness) {
          md += `- **${formatDate(pain.date)}** ${pain.location} (严重程度: ${pain.severity}/10) ${pain.description ? '- ' + pain.description : ''}\n`;
        }
        md += '\n';
      }
    }
    
    md += `## 训练数据统计\n\n`;
    
    const dateRange = aggregator.getDateRange();
    md += `- 数据周期: ${dateRange.start ? formatDate(dateRange.start) : '-'} 至 ${dateRange.end ? formatDate(dateRange.end) : '-'}\n`;
    md += `- 总跑步次数: ${aggregator.runs.length}\n`;
    md += `- 总距离: ${aggregator.runs.reduce((sum, r) => sum + r.distance, 0).toFixed(1)} km\n`;
    md += `- 总爬升: ${aggregator.runs.reduce((sum, r) => sum + r.elevation, 0).toFixed(0)} m\n\n`;
    
    const uniqueShoes = aggregator.getUniqueShoes();
    if (uniqueShoes.length > 0) {
      md += `- 使用鞋款: ${uniqueShoes.length} 双 (${uniqueShoes.join(', ')})\n\n`;
    }
    
    const allErrors = [
      ...(runs?.errors || []).map(e => ({ ...e, file: 'runs.csv' })),
      ...(shoesValidation?.errors || []).map(e => ({ ...e, file: 'shoes.json' })),
      ...(sorenessValidation?.errors || []).map(e => ({ ...e, file: 'soreness.csv' }))
    ];
    
    const allWarnings = [
      ...(runs?.warnings || []).map(e => ({ ...e, file: 'runs.csv' })),
      ...(shoesValidation?.warnings || []).map(e => ({ ...e, file: 'shoes.json' })),
      ...(sorenessValidation?.warnings || []).map(e => ({ ...e, file: 'soreness.csv' }))
    ];
    
    if (allErrors.length > 0 || allWarnings.length > 0) {
      md += `## 数据质量问题\n\n`;
      
      if (allErrors.length > 0) {
        md += `### 错误 (${allErrors.length} 个)\n\n`;
        for (const e of allErrors) {
          md += `- **${e.file}** 第${e.row}行: ${e.message}\n`;
        }
        md += '\n';
      }
      
      if (allWarnings.length > 0) {
        md += `### 警告 (${allWarnings.length} 个)\n\n`;
        for (const w of allWarnings) {
          md += `- **${w.file}** 第${w.row}行: ${w.message}\n`;
        }
        md += '\n';
      }
    }
    
    md += `---\n\n`;
    md += `*报告由 Running Analyzer 生成*\n`;
    
    return md;
  }

  generateHTML(analysis, validation) {
    const markdown = this.generateMarkdown(analysis, validation);
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>跑步训练负荷分析报告</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    h2 { color: #2980b9; margin-top: 30px; }
    h3 { color: #34495e; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f8f9fa; font-weight: 600; }
    tr:nth-child(even) { background-color: #f8f9fa; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
    hr { border: none; border-top: 1px solid #eee; margin: 30px 0; }
    .risk-danger { color: #dc3545; font-weight: bold; }
    .risk-warning { color: #ffc107; font-weight: bold; }
    .risk-safe { color: #28a745; font-weight: bold; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 4px; overflow-x: auto; }
    .summary-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 10px;
      margin: 20px 0;
    }
    .summary-box h2 { color: white; margin-top: 0; }
  </style>
</head>
<body>
${this.markdownToHTML(markdown)}
</body>
</html>`;
  }

  markdownToHTML(md) {
    return md
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^---$/gm, '<hr>')
      .replace(/^```(\w+)?\n([\s\S]*?)^```$/gm, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^- (.*)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, '<ul>\n$&</ul>')
      .replace(/^\|(.*)\|$/gm, (match) => {
        if (match.includes('---')) return '';
        const cells = match.slice(1, -1).split('|').map(c => c.trim());
        if (cells.every(c => c === '' || /^-+$/.test(c))) return '';
        return match;
      });
  }

  generateJSON(analysis, validation) {
    const { risk, shoes, soreness, aggregator } = analysis;
    const { runs, shoes: shoesValidation, soreness: sorenessValidation } = validation;
    
    return JSON.stringify({
      generatedAt: this.referenceDate.toISOString(),
      summary: {
        overallLevel: risk.summary.overallLevel,
        riskCount: risk.summary.riskCount,
        warningCount: risk.summary.warningCount,
        shoesNeedingAttention: shoes.stats.shoesNeedingAttention,
        recentSorenessRecords: soreness.summary.recentRecords
      },
      riskAnalysis: {
        risks: risk.risks,
        warnings: risk.warnings,
        acwr: {
          value: risk.acwr.acwr,
          acuteWorkload: risk.acwr.acuteWorkload,
          chronicAvgWorkload: risk.acwr.chronicAvgWorkload,
          message: risk.acwr.message
        }
      },
      shoesAnalysis: {
        stats: shoes.stats,
        alerts: shoes.alerts,
        warnings: shoes.warnings,
        rotationSuggestions: shoes.rotationSuggestions,
        shoeStats: shoes.shoeStats.map(s => ({
          name: s.name,
          totalDistance: s.totalDistance,
          mileageStatus: s.mileageStatus,
          usageStatus: s.usageStatus,
          overallStatus: s.overallStatus,
          lastRunStr: s.lastRunStr,
          remainingMileage: s.remainingMileage
        }))
      },
      sorenessAnalysis: soreness.summary.totalSorenessRecords > 0 ? {
        locationStats: soreness.locationStats,
        patterns: {
          hasPatterns: soreness.patterns.hasPatterns,
          highRiskShoes: soreness.patterns.highRiskShoes,
          highRiskSurfaces: soreness.patterns.highRiskSurfaces,
          highRiskTypes: soreness.patterns.highRiskTypes
        },
        recentSoreness: soreness.recentSoreness.map(s => ({
          dateStr: s.dateStr,
          location: s.location,
          severity: s.severity,
          description: s.description
        }))
      } : null,
      dataValidation: {
        errors: [
          ...(runs?.errors || []).map(e => ({ ...e, file: 'runs.csv' })),
          ...(shoesValidation?.errors || []).map(e => ({ ...e, file: 'shoes.json' })),
          ...(sorenessValidation?.errors || []).map(e => ({ ...e, file: 'soreness.csv' }))
        ],
        warnings: [
          ...(runs?.warnings || []).map(e => ({ ...e, file: 'runs.csv' })),
          ...(shoesValidation?.warnings || []).map(e => ({ ...e, file: 'shoes.json' })),
          ...(sorenessValidation?.warnings || []).map(e => ({ ...e, file: 'soreness.csv' }))
        ]
      }
    }, null, 2);
  }

  getLevelText(level) {
    const texts = {
      danger: '高风险 - 建议立即调整训练计划',
      warning: '中风险 - 需要关注并适当调整',
      safe: '正常 - 继续保持'
    };
    return texts[level] || level;
  }
}

export function generateReport(analysis, validation, format = 'markdown', options = {}) {
  const generator = new ReportGenerator(options);
  
  switch (format) {
    case 'html':
      return generator.generateHTML(analysis, validation);
    case 'json':
      return generator.generateJSON(analysis, validation);
    case 'markdown':
    default:
      return generator.generateMarkdown(analysis, validation);
  }
}
