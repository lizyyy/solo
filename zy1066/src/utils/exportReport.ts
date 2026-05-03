import { Route, WallConfig, UserProfile, ExportReport, RiskLevel, DifficultyLevel } from '../types';
import { calculateRiskAssessment, calculateOverallRisk } from './riskCalculator';

export function generateReport(
  wall: WallConfig,
  routes: Route[],
  userProfile: UserProfile,
  title?: string
): ExportReport {
  const wallRoutes = routes.filter(r => r.wallId === wall.id);
  const overall = calculateOverallRisk(wallRoutes, wall, userProfile);
  
  const routesWithAssessment = wallRoutes.map(route => ({
    ...route,
    assessment: calculateRiskAssessment(route, wall, userProfile),
  }));

  const byDifficulty: Record<DifficultyLevel, number> = {
    beginner: 0,
    intermediate: 0,
    advanced: 0,
  };
  
  const byRisk: Record<RiskLevel, number> = {
    safe: 0,
    warning: 0,
    danger: 0,
  };

  for (const route of routesWithAssessment) {
    byDifficulty[route.difficulty]++;
    byRisk[route.assessment.overallRisk]++;
  }

  const recommendations = generateRecommendations(routesWithAssessment, wall);

  return {
    title: title || `${wall.name} - 定线报告`,
    generatedAt: new Date().toISOString(),
    wall,
    routes: routesWithAssessment,
    overallSummary: {
      totalRoutes: wallRoutes.length,
      byDifficulty,
      byRisk,
      avgRiskScore: overall.avgRiskScore,
    },
    recommendations,
  };
}

function generateRecommendations(
  routes: (Route & { assessment: any })[],
  _wall: WallConfig
): string[] {
  const recommendations: string[] = [];
  
  const dangerRoutes = routes.filter(r => r.assessment.overallRisk === 'danger');
  const warningRoutes = routes.filter(r => r.assessment.overallRisk === 'warning');
  
  if (dangerRoutes.length > 0) {
    recommendations.push(`⚠️ 发现 ${dangerRoutes.length} 条高风险线路，建议优先调整: ${dangerRoutes.map(r => r.name).join(', ')}`);
  }
  
  if (warningRoutes.length > 0) {
    recommendations.push(`⚡ 发现 ${warningRoutes.length} 条中等风险线路，建议检查: ${warningRoutes.map(r => r.name).join(', ')}`);
  }

  const routesMissingStart = routes.filter(r => !r.holds.some(h => h.isStart));
  const routesMissingEnd = routes.filter(r => !r.holds.some(h => h.isEnd));
  
  if (routesMissingStart.length > 0) {
    recommendations.push(`📍 以下线路缺少起点标记: ${routesMissingStart.map(r => r.name).join(', ')}`);
  }
  
  if (routesMissingEnd.length > 0) {
    recommendations.push(`🎯 以下线路缺少终点标记: ${routesMissingEnd.map(r => r.name).join(', ')}`);
  }

  const shortRoutes = routes.filter(r => r.holds.length < 3);
  if (shortRoutes.length > 0) {
    recommendations.push(`💡 以下线路岩点数量偏少 (少于3个): ${shortRoutes.map(r => r.name).join(', ')}`);
  }

  const beginnerRoutes = routes.filter(r => r.difficulty === 'beginner');
  const intermediateRoutes = routes.filter(r => r.difficulty === 'intermediate');
  const advancedRoutes = routes.filter(r => r.difficulty === 'advanced');
  
  if (beginnerRoutes.length === 0 && routes.length > 0) {
    recommendations.push('📊 当前墙面上没有初级线路，建议增加适合新手的线路');
  }
  
  if (advancedRoutes.length > intermediateRoutes.length * 2 && intermediateRoutes.length > 0) {
    recommendations.push('📊 高级线路数量偏多，建议增加中级线路以平衡难度分布');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ 所有线路设计均通过风险评估，可按计划铺设');
  }

  return recommendations;
}

export function exportAsMarkdown(report: ExportReport): string {
  const difficultyNames: Record<string, string> = {
    beginner: '初级',
    intermediate: '中级',
    advanced: '高级',
  };
  
  const riskNames: Record<string, string> = {
    safe: '安全',
    warning: '中等风险',
    danger: '高风险',
  };

  const shapeNames: Record<string, string> = {
    jug: '大岩点',
    crimp: '小抠点',
    pocket: '孔洞点',
    edge: '条型点',
    sloper: '大斜面',
  };

  const sizeNames: Record<string, string> = {
    small: '小号',
    medium: '中号',
    large: '大号',
  };

  let md = `# ${report.title}\n\n`;
  md += `> 生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}\n\n`;

  md += `## 📋 概览\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 总线路数 | ${report.overallSummary.totalRoutes} |\n`;
  md += `| 初级线路 | ${report.overallSummary.byDifficulty.beginner} |\n`;
  md += `| 中级线路 | ${report.overallSummary.byDifficulty.intermediate} |\n`;
  md += `| 高级线路 | ${report.overallSummary.byDifficulty.advanced} |\n`;
  md += `| 安全线路 | ${report.overallSummary.byRisk.safe} |\n`;
  md += `| 中等风险 | ${report.overallSummary.byRisk.warning} |\n`;
  md += `| 高风险 | ${report.overallSummary.byRisk.danger} |\n`;
  md += `| 平均风险分 | ${report.overallSummary.avgRiskScore}/100 |\n\n`;

  md += `## 🧱 墙面信息\n\n`;
  md += `- **名称**: ${report.wall.name}\n`;
  md += `- **尺寸**: ${report.wall.width}cm × ${report.wall.height}cm\n`;
  md += `- **倾角**: ${report.wall.angle}°\n`;
  if (report.wall.zones.length > 0) {
    md += `- **分区**: ${report.wall.zones.map(z => z.name).join(', ')}\n`;
  }
  md += `\n`;

  md += `## 📍 线路详情\n\n`;
  
  for (const route of report.routes) {
    const riskEmoji = route.assessment.overallRisk === 'danger' ? '🔴' 
      : route.assessment.overallRisk === 'warning' ? '🟡' : '🟢';
    
    md += `### ${riskEmoji} ${route.name}\n\n`;
    md += `- **难度**: ${difficultyNames[route.difficulty]}\n`;
    md += `- **预估难度等级**: ${route.estimatedGrade || '未设置'}\n`;
    md += `- **风险等级**: ${riskNames[route.assessment.overallRisk]} (${route.assessment.riskScore}/100)\n`;
    md += `- **岩点数量**: ${route.holds.length}\n\n`;

    const sortedHolds = [...route.holds].sort((a, b) => a.order - b.order);
    md += `**岩点清单**:\n\n`;
    md += `| 序号 | 类型 | 尺寸 | 颜色 | 标记 |\n`;
    md += `|------|------|------|------|------|\n`;
    for (const hold of sortedHolds) {
      const markers = [];
      if (hold.isStart) markers.push('起点');
      if (hold.isEnd) markers.push('终点');
      
      md += `| ${hold.order + 1} | ${shapeNames[hold.shape]} | ${sizeNames[hold.size]} | ${hold.color} | ${markers.join(', ') || '-'} |\n`;
    }
    md += `\n`;

    md += `**风险评估**:\n\n`;
    for (const assessment of route.assessment.assessments) {
      const levelEmoji = assessment.level === 'danger' ? '🔴' 
        : assessment.level === 'warning' ? '⚠️' : '✅';
      md += `- ${levelEmoji} ${assessment.message}\n`;
      if (assessment.details) {
        md += `  - ${assessment.details}\n`;
      }
    }
    md += `\n`;
  }

  md += `## 💡 调整建议\n\n`;
  for (const rec of report.recommendations) {
    md += `- ${rec}\n`;
  }
  md += `\n`;

  md += `---\n\n`;
  md += `> 此报告由攀岩馆线路摆点预演器自动生成\n`;

  return md;
}

export function exportAsHTML(report: ExportReport): string {
  const markdown = exportAsMarkdown(report);
  
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f8fafc;
    }
    h1 { font-size: 2rem; margin-bottom: 20px; color: #1e293b; }
    h2 { font-size: 1.5rem; margin: 30px 0 15px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    h3 { font-size: 1.25rem; margin: 25px 0 12px; color: #475569; }
    blockquote {
      background: #f1f5f9;
      border-left: 4px solid #3b82f6;
      padding: 12px 16px;
      margin: 16px 0;
      border-radius: 0 8px 8px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 10px 12px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    ul { margin: 12px 0 12px 24px; }
    li { margin: 6px 0; }
    hr { margin: 30px 0; border: none; border-top: 1px solid #e2e8f0; }
    .container {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div class="container">
    ${markdownToHTML(markdown)}
  </div>
</body>
</html>
  `.trim();

  return html;
}

function markdownToHTML(md: string): string {
  let html = md;
  
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  
  html = html.replace(/^\|(.+)\|$/gm, (_, content) => {
    const cells = content.split('|').map((c: string) => c.trim()).filter(Boolean);
    return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join('')}</tr>`;
  });
  
  html = html.replace(/^(---|\*\*\*)$/gm, '<hr>');
  
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  html = html.split('\n').map(line => {
    if (line.startsWith('<tr>') || line.startsWith('</') || line.startsWith('<h') || 
        line.startsWith('<blockquote') || line.startsWith('<hr') || 
        line.startsWith('<li') || line.startsWith('<table') || line.startsWith('</table')) {
      return line;
    }
    if (line.trim() === '') {
      return '';
    }
    return `<p>${line}</p>`;
  }).join('\n');

  html = html.replace(/(<tr>.*?<\/tr>\s*)+/g, (match) => {
    const rows = match.trim().split('\n').filter(Boolean);
    if (rows.length === 0) return match;
    
    const hasHeader = rows[0].includes('指标') || rows[0].includes('序号');
    
    if (hasHeader && rows.length > 1) {
      const headerRow = rows[0].replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
      return `<table><thead>${headerRow}</thead><tbody>${rows.slice(1).join('')}</tbody></table>`;
    }
    return `<table>${rows.join('')}</table>`;
  });

  html = html.replace(/(<li>.*?<\/li>\s*)+/g, (match) => {
    return `<ul>${match}</ul>`;
  });

  return html;
}

export function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
