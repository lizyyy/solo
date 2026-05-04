import { Plan, LayoutReport, ReportFormat, ValidationResult, RiskLevel, ValidationCategory, BoothType } from '../types';
import { validationService } from './validationService';

export const reportService = {
  generateReport(plan: Plan): LayoutReport {
    const validationResults = validationService.validate(plan);
    const failedResults = validationResults.filter(r => !r.passed);

    const byLevel: Record<RiskLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    const byCategory: Record<ValidationCategory, number> = {
      safety: 0,
      flow: 0,
      power: 0,
      layout: 0,
      compliance: 0
    };

    const recommendations: string[] = [];

    for (const result of failedResults) {
      byLevel[result.riskLevel]++;
      byCategory[result.category]++;
      
      if (result.riskLevel === 'critical') {
        recommendations.push(`[紧急] ${result.message} - ${result.details}`);
      } else if (result.riskLevel === 'high') {
        recommendations.push(`[重要] ${result.message} - ${result.details}`);
      }
    }

    const byType: Record<BoothType, number> = {
      standard: 0,
      corner: 0,
      island: 0,
      double: 0,
      premium: 0,
      stage: 0,
      info_desk: 0,
      food: 0,
      sponsor: 0,
      other: 0
    };

    for (const booth of plan.booths) {
      byType[booth.type]++;
    }

    const popularCount = plan.booths.filter(b => b.isPopular).length;
    const totalPowerDemand = plan.booths.reduce((sum, b) => sum + b.powerDemand, 0);

    return {
      planId: plan.id,
      planName: plan.name,
      generatedAt: new Date(),
      hallInfo: plan.hall,
      boothsSummary: {
        total: plan.booths.length,
        byType,
        popularCount,
        totalPowerDemand
      },
      validationResults,
      summary: {
        totalIssues: failedResults.length,
        byLevel,
        byCategory
      },
      recommendations: recommendations.length > 0 
        ? recommendations 
        : ['所有规则校验通过，布展方案符合规范要求。']
    };
  },

  exportReport(report: LayoutReport, format: ReportFormat): string {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'html':
        return this.exportAsHtml(report);
      case 'markdown':
      default:
        return this.exportAsMarkdown(report);
    }
  },

  exportAsMarkdown(report: LayoutReport): string {
    const lines: string[] = [];

    lines.push(`# ${report.planName} - 布展方案核对报告`);
    lines.push('');
    lines.push(`> 生成时间: ${report.generatedAt.toLocaleString('zh-CN')}`);
    lines.push('');

    lines.push('## 一、展厅信息');
    lines.push('');
    lines.push(`- 展厅名称: ${report.hallInfo.name}`);
    lines.push(`- 展厅尺寸: ${report.hallInfo.dimensions.width}m × ${report.hallInfo.dimensions.depth}m × ${report.hallInfo.dimensions.height || 'N/A'}m`);
    lines.push(`- 网格尺寸: ${report.hallInfo.gridSize}m`);
    lines.push(`- 入口数量: ${report.hallInfo.entrances.length}`);
    lines.push(`- 出口数量: ${report.hallInfo.exits.length}`);
    lines.push('');

    lines.push('## 二、展位统计');
    lines.push('');
    lines.push(`- 总展位数: ${report.boothsSummary.total}`);
    lines.push(`- 热门展位数: ${report.boothsSummary.popularCount}`);
    lines.push(`- 总功率需求: ${report.boothsSummary.totalPowerDemand.toLocaleString()} W`);
    lines.push('');
    lines.push('### 展位类型分布');
    lines.push('');
    lines.push('| 类型 | 数量 |');
    lines.push('|------|------|');
    
    const typeNames: Record<BoothType, string> = {
      standard: '标准展位',
      corner: '转角展位',
      island: '岛型展位',
      double: '双开展位',
      premium: '豪华展位',
      stage: '舞台',
      info_desk: '服务台',
      food: '餐饮区',
      sponsor: '赞助商展位',
      other: '其他'
    };

    for (const [type, count] of Object.entries(report.boothsSummary.byType)) {
      if (count > 0) {
        lines.push(`| ${typeNames[type as BoothType]} | ${count} |`);
      }
    }
    lines.push('');

    lines.push('## 三、规则校验结果');
    lines.push('');

    if (report.summary.totalIssues === 0) {
      lines.push('✅ **所有校验通过**，没有发现问题。');
    } else {
      lines.push('### 问题概览');
      lines.push('');
      lines.push(`- 总问题数: ${report.summary.totalIssues}`);
      lines.push('');
      lines.push('#### 按风险等级');
      lines.push('');
      lines.push('| 等级 | 数量 |');
      lines.push('|------|------|');
      lines.push(`| 🔴 严重 | ${report.summary.byLevel.critical} |`);
      lines.push(`| 🟠 高 | ${report.summary.byLevel.high} |`);
      lines.push(`| 🟡 中 | ${report.summary.byLevel.medium} |`);
      lines.push(`| 🟢 低 | ${report.summary.byLevel.low} |`);
      lines.push('');

      lines.push('#### 按问题分类');
      lines.push('');
      lines.push('| 分类 | 数量 |');
      lines.push('|------|------|');
      
      const categoryNames: Record<ValidationCategory, string> = {
        safety: '安全',
        flow: '人流',
        power: '用电',
        layout: '布局',
        compliance: '合规'
      };

      for (const [category, count] of Object.entries(report.summary.byCategory)) {
        if (count > 0) {
          lines.push(`| ${categoryNames[category as ValidationCategory]} | ${count} |`);
        }
      }
      lines.push('');

      const failedResults = report.validationResults.filter(r => !r.passed);
      const criticalResults = failedResults.filter(r => r.riskLevel === 'critical');
      const highResults = failedResults.filter(r => r.riskLevel === 'high');
      const otherResults = failedResults.filter(r => r.riskLevel !== 'critical' && r.riskLevel !== 'high');

      if (criticalResults.length > 0) {
        lines.push('### 🔴 严重问题');
        lines.push('');
        for (const result of criticalResults) {
          lines.push(`#### ${result.ruleName}`);
          lines.push('');
          lines.push(`**问题:** ${result.message}`);
          lines.push('');
          lines.push(`**详情:** ${result.details}`);
          lines.push('');
          if (result.location) {
            lines.push(`**位置:** (${result.location.x.toFixed(1)}, ${result.location.y.toFixed(1)})`);
            lines.push('');
          }
        }
      }

      if (highResults.length > 0) {
        lines.push('### 🟠 高优先级问题');
        lines.push('');
        for (const result of highResults) {
          lines.push(`#### ${result.ruleName}`);
          lines.push('');
          lines.push(`**问题:** ${result.message}`);
          lines.push('');
          lines.push(`**详情:** ${result.details}`);
          lines.push('');
        }
      }

      if (otherResults.length > 0) {
        lines.push('### 🟡 其他问题');
        lines.push('');
        for (const result of otherResults) {
          lines.push(`- **${result.ruleName}:** ${result.message}`);
        }
        lines.push('');
      }
    }

    lines.push('## 四、建议');
    lines.push('');
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('*此报告由布展预演工具自动生成*');

    return lines.join('\n');
  },

  exportAsHtml(report: LayoutReport): string {
    const markdown = this.exportAsMarkdown(report);
    
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.planName} - 布展方案核对报告</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #333;
            line-height: 1.6;
        }
        h1 { color: #1e3a8a; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
        h2 { color: #1e40af; margin-top: 40px; }
        h3 { color: #2563eb; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
        th { background-color: #eff6ff; font-weight: 600; }
        .critical { background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .high { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 10px 0; border-radius: 4px; }
        blockquote { background-color: #f8fafc; border-left: 4px solid #94a3b8; padding: 15px; margin: 0; border-radius: 4px; }
        footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; text-align: center; }
    </style>
</head>
<body>
    <h1>${report.planName} - 布展方案核对报告</h1>
    <blockquote>生成时间: ${report.generatedAt.toLocaleString('zh-CN')}</blockquote>
    
    <h2>一、展厅信息</h2>
    <ul>
        <li><strong>展厅名称:</strong> ${report.hallInfo.name}</li>
        <li><strong>展厅尺寸:</strong> ${report.hallInfo.dimensions.width}m × ${report.hallInfo.dimensions.depth}m × ${report.hallInfo.dimensions.height || 'N/A'}m</li>
        <li><strong>网格尺寸:</strong> ${report.hallInfo.gridSize}m</li>
        <li><strong>入口数量:</strong> ${report.hallInfo.entrances.length}</li>
        <li><strong>出口数量:</strong> ${report.hallInfo.exits.length}</li>
    </ul>
    
    <h2>二、展位统计</h2>
    <ul>
        <li><strong>总展位数:</strong> ${report.boothsSummary.total}</li>
        <li><strong>热门展位数:</strong> ${report.boothsSummary.popularCount}</li>
        <li><strong>总功率需求:</strong> ${report.boothsSummary.totalPowerDemand.toLocaleString()} W</li>
    </ul>
    
    <h3>展位类型分布</h3>
    <table>
        <tr><th>类型</th><th>数量</th></tr>
        ${Object.entries(report.boothsSummary.byType)
            .filter(([, count]) => count > 0)
            .map(([type, count]) => {
                const typeNames: Record<string, string> = {
                    standard: '标准展位', corner: '转角展位', island: '岛型展位',
                    double: '双开展位', premium: '豪华展位', stage: '舞台',
                    info_desk: '服务台', food: '餐饮区', sponsor: '赞助商展位', other: '其他'
                };
                return `<tr><td>${typeNames[type] || type}</td><td>${count}</td></tr>`;
            }).join('')}
    </table>
    
    <h2>三、规则校验结果</h2>
    
    ${report.summary.totalIssues === 0 
        ? '<p style="color: #16a34a; font-size: 18px; font-weight: bold;">✅ 所有校验通过，没有发现问题。</p>'
        : `<p><strong>总问题数:</strong> ${report.summary.totalIssues}</p>
           <h3>按风险等级</h3>
           <table>
               <tr><th>等级</th><th>数量</th></tr>
               <tr><td>🔴 严重</td><td>${report.summary.byLevel.critical}</td></tr>
               <tr><td>🟠 高</td><td>${report.summary.byLevel.high}</td></tr>
               <tr><td>🟡 中</td><td>${report.summary.byLevel.medium}</td></tr>
               <tr><td>🟢 低</td><td>${report.summary.byLevel.low}</td></tr>
           </table>`
    }
    
    <h2>四、建议</h2>
    <ul>
        ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
    </ul>
    
    <footer>此报告由布展预演工具自动生成</footer>
</body>
</html>`;

    return html;
  }
};
