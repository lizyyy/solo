import type { 
  AppData, 
  ExportOptions,
  Route
} from '../types';
import { processAllRoutes, getCongestionRiskLabel, getTrendLabel, formatTimeSlot } from './dataProcessor';

export const generateMarkdownReport = (
  appData: AppData,
  options: ExportOptions
): string => {
  const statsMap = processAllRoutes(appData);
  const { routes, memberFlows, ascents, incidentNotes, coachNotes, gradeOverrides, alerts } = appData;
  
  const allTimeSlots: Record<number, number> = {};
  for (const route of routes) {
    const stats = statsMap.get(route.id);
    if (stats) {
      for (const slot of stats.popularTimeSlots) {
        allTimeSlots[slot.hour] = (allTimeSlots[slot.hour] || 0) + slot.count;
      }
    }
  }
  
  const dateStr = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let markdown = `# 攀岩馆线路复盘报告\n\n`;
  markdown += `**生成时间**: ${dateStr}\n\n`;
  markdown += `---\n\n`;

  markdown += `## 一、数据概览\n\n`;
  markdown += `| 数据类型 | 数量 |\n`;
  markdown += `|---------|------|\n`;
  markdown += `| 线路总数 | ${routes.length} |\n`;
  markdown += `| 客流记录 | ${memberFlows.length} |\n`;
  markdown += `| 完攀记录 | ${ascents.length} |\n`;
  markdown += `| 伤情/投诉 | ${incidentNotes.length} |\n`;
  markdown += `| 教练备注 | ${coachNotes.length} |\n`;
  markdown += `| 难度改判 | ${gradeOverrides.length} |\n`;
  markdown += `| 异常提醒 | ${alerts.length} |\n\n`;

  if (options.includeRoutes && routes.length > 0) {
    markdown += `## 二、线路统计\n\n`;
    
    const difficultyGroups: Record<string, Route[]> = {};
    for (const route of routes) {
      if (!difficultyGroups[route.difficulty]) {
        difficultyGroups[route.difficulty] = [];
      }
      difficultyGroups[route.difficulty].push(route);
    }
    
    const zoneGroups: Record<string, Route[]> = {};
    for (const route of routes) {
      if (!zoneGroups[route.zone]) {
        zoneGroups[route.zone] = [];
      }
      zoneGroups[route.zone].push(route);
    }
    
    markdown += `### 2.1 按难度分布\n\n`;
    markdown += `| 难度 | 线路数 | 平均完攀率 |\n`;
    markdown += `|-----|-------|-----------|\n`;
    for (const [difficulty, routeList] of Object.entries(difficultyGroups).sort()) {
      const totalSuccess = routeList.reduce((sum, route) => {
        const stats = statsMap.get(route.id);
        return sum + (stats?.successfulAscents || 0);
      }, 0);
      const totalAttempts = routeList.reduce((sum, route) => {
        const stats = statsMap.get(route.id);
        return sum + (stats?.totalAttempts || 0);
      }, 0);
      const avgRate = totalAttempts > 0 ? (totalSuccess / totalAttempts) * 100 : 0;
      markdown += `| ${difficulty} | ${routeList.length} | ${avgRate.toFixed(1)}% |\n`;
    }
    markdown += `\n`;
    
    markdown += `### 2.2 按区域分布\n\n`;
    markdown += `| 区域 | 线路数 | 平均完攀率 |\n`;
    markdown += `|-----|-------|-----------|\n`;
    for (const [zone, routeList] of Object.entries(zoneGroups).sort()) {
      const totalSuccess = routeList.reduce((sum, route) => {
        const stats = statsMap.get(route.id);
        return sum + (stats?.successfulAscents || 0);
      }, 0);
      const totalAttempts = routeList.reduce((sum, route) => {
        const stats = statsMap.get(route.id);
        return sum + (stats?.totalAttempts || 0);
      }, 0);
      const avgRate = totalAttempts > 0 ? (totalSuccess / totalAttempts) * 100 : 0;
      markdown += `| ${zone} | ${routeList.length} | ${avgRate.toFixed(1)}% |\n`;
    }
    markdown += `\n`;
  }

  if (options.includeStats && routes.length > 0) {
    markdown += `## 三、热门线路分析\n\n`;
    
    const sortedByPopularity = [...routes]
      .map(route => ({ route, stats: statsMap.get(route.id)! }))
      .filter(({ stats }) => stats && stats.totalAttempts > 0)
      .sort((a, b) => b.stats.totalAttempts - a.stats.totalAttempts)
      .slice(0, 10);
    
    if (sortedByPopularity.length > 0) {
      markdown += `### 3.1 最热门线路 TOP 10\n\n`;
      markdown += `| 排名 | 线路名称 | 难度 | 区域 | 尝试次数 | 完攀率 | 拥堵风险 | 趋势 |\n`;
      markdown += `|-----|---------|-----|-----|---------|-------|---------|-----|\n`;
      for (let i = 0; i < sortedByPopularity.length; i++) {
        const { route, stats } = sortedByPopularity[i];
        markdown += `| ${i + 1} | ${route.name} | ${route.difficulty} | ${route.zone} | ${stats.totalAttempts} | ${stats.successRate.toFixed(1)}% | ${getCongestionRiskLabel(stats.congestionRisk)} | ${getTrendLabel(stats.recentTrend)} |\n`;
      }
      markdown += `\n`;
    }
    
    const sortedByLowRate = [...routes]
      .map(route => ({ route, stats: statsMap.get(route.id)! }))
      .filter(({ stats }) => stats && stats.successfulAscents > 3)
      .sort((a, b) => a.stats.successRate - b.stats.successRate)
      .slice(0, 5);
    
    if (sortedByLowRate.length > 0) {
      markdown += `### 3.2 完攀率最低线路 (需关注)\n\n`;
      markdown += `| 排名 | 线路名称 | 难度 | 区域 | 尝试次数 | 完攀率 | 平均尝试次数 |\n`;
      markdown += `|-----|---------|-----|-----|---------|-------|-------------|\n`;
      for (let i = 0; i < sortedByLowRate.length; i++) {
        const { route, stats } = sortedByLowRate[i];
        markdown += `| ${i + 1} | ${route.name} | ${route.difficulty} | ${route.zone} | ${stats.totalAttempts} | ${stats.successRate.toFixed(1)}% | ${stats.avgAttemptsPerSuccess.toFixed(1)} |\n`;
      }
      markdown += `\n`;
    }
    
    const sortedByHighRate = [...routes]
      .map(route => ({ route, stats: statsMap.get(route.id)! }))
      .filter(({ stats }) => stats && stats.successfulAscents > 3)
      .sort((a, b) => b.stats.successRate - a.stats.successRate)
      .slice(0, 5);
    
    if (sortedByHighRate.length > 0) {
      markdown += `### 3.3 完攀率最高线路 (参考)\n\n`;
      markdown += `| 排名 | 线路名称 | 难度 | 区域 | 尝试次数 | 完攀率 |\n`;
      markdown += `|-----|---------|-----|-----|---------|-------|\n`;
      for (let i = 0; i < sortedByHighRate.length; i++) {
        const { route, stats } = sortedByHighRate[i];
        markdown += `| ${i + 1} | ${route.name} | ${route.difficulty} | ${route.zone} | ${stats.totalAttempts} | ${stats.successRate.toFixed(1)}% |\n`;
      }
      markdown += `\n`;
    }
    
    markdown += `### 3.4 热门时段分析\n\n`;
    const totalTimeSlotEntries = Object.entries(allTimeSlots).sort((a, b) => b[1] - a[1]);
    if (totalTimeSlotEntries.length > 0) {
      markdown += `| 时段 | 活动量 | 占比 |\n`;
      markdown += `|-----|-------|-----|\n`;
      const totalCount = totalTimeSlotEntries.reduce((sum, [, count]) => sum + count, 0);
      for (const [hourStr, count] of totalTimeSlotEntries.slice(0, 5)) {
        const hour = parseInt(hourStr);
        const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
        markdown += `| ${formatTimeSlot({ hour, count, percentage })} | ${count} | ${percentage.toFixed(1)}% |\n`;
      }
      markdown += `\n`;
    }
  }

  if (options.includeAlerts && alerts.length > 0) {
    markdown += `## 四、异常提醒\n\n`;
    
    const highSeverity = alerts.filter(a => a.severity === 'high');
    const mediumSeverity = alerts.filter(a => a.severity === 'medium');
    const lowSeverity = alerts.filter(a => a.severity === 'low');
    
    if (highSeverity.length > 0) {
      markdown += `### 4.1 高优先级提醒\n\n`;
      for (const alert of highSeverity) {
        const routeName = routes.find(r => r.id === alert.routeId)?.name || '未知线路';
        markdown += `#### ${alert.message}\n\n`;
        markdown += `**相关线路**: ${routeName}\n\n`;
        markdown += `**详情**:\n\n`;
        markdown += `\`\`\`\n${alert.details}\n\`\`\`\n\n`;
      }
    }
    
    if (mediumSeverity.length > 0) {
      markdown += `### 4.2 中优先级提醒\n\n`;
      for (const alert of mediumSeverity) {
        const routeName = routes.find(r => r.id === alert.routeId)?.name || '未知线路';
        markdown += `- **${alert.message}** (${routeName})\n`;
      }
      markdown += `\n`;
    }
    
    if (lowSeverity.length > 0) {
      markdown += `### 4.3 低优先级提醒\n\n`;
      for (const alert of lowSeverity) {
        markdown += `- ${alert.message}\n`;
      }
      markdown += `\n`;
    }
  }

  if (options.includeNotes) {
    if (incidentNotes.length > 0) {
      markdown += `## 五、伤情与投诉记录\n\n`;
      
      const unresolved = incidentNotes.filter(n => n.status !== 'resolved');
      const resolved = incidentNotes.filter(n => n.status === 'resolved');
      
      if (unresolved.length > 0) {
        markdown += `### 5.1 未解决事项\n\n`;
        markdown += `| 类型 | 标题 | 严重程度 | 时间 |\n`;
        markdown += `|-----|-----|---------|-----|\n`;
        for (const note of unresolved) {
          const typeLabel = note.type === 'injury' ? '伤情' : note.type === 'complaint' ? '投诉' : '观察';
          const severityLabel = note.severity === 'high' ? '高' : note.severity === 'medium' ? '中' : '低';
          markdown += `| ${typeLabel} | ${note.title} | ${severityLabel} | ${note.timestamp} |\n`;
        }
        markdown += `\n`;
      }
      
      if (resolved.length > 0) {
        markdown += `### 5.2 已解决事项\n\n`;
        for (const note of resolved) {
          const typeLabel = note.type === 'injury' ? '伤情' : note.type === 'complaint' ? '投诉' : '观察';
          markdown += `#### ${typeLabel}: ${note.title}\n\n`;
          markdown += `**时间**: ${note.timestamp}\n\n`;
          if (note.resolution) {
            markdown += `**解决方案**: ${note.resolution}\n\n`;
          }
        }
      }
    }
    
    if (coachNotes.length > 0) {
      markdown += `## 六、教练备注\n\n`;
      
      const groupedNotes: Record<string, typeof coachNotes> = {};
      for (const note of coachNotes) {
        const routeName = routes.find(r => r.id === note.routeId)?.name || '通用备注';
        if (!groupedNotes[routeName]) {
          groupedNotes[routeName] = [];
        }
        groupedNotes[routeName].push(note);
      }
      
      for (const [routeName, notes] of Object.entries(groupedNotes)) {
        markdown += `### ${routeName}\n\n`;
        for (const note of notes) {
          const categoryLabel = note.category === 'observation' ? '观察' :
            note.category === 'suggestion' ? '建议' :
            note.category === 'grade_adjustment' ? '难度调整' : '安全';
          markdown += `**${categoryLabel}** (${note.coachName}, ${note.timestamp})\n\n`;
          markdown += `${note.content}\n\n`;
        }
      }
    }
    
    if (gradeOverrides.length > 0) {
      markdown += `## 七、难度改判记录\n\n`;
      markdown += `| 线路名称 | 原难度 | 新难度 | 改判教练 | 状态 | 时间 |\n`;
      markdown += `|---------|-------|-------|---------|-----|-----|\n`;
      for (const override of gradeOverrides) {
        const routeName = routes.find(r => r.id === override.routeId)?.name || '未知线路';
        const statusLabel = override.status === 'approved' ? '已批准' :
          override.status === 'rejected' ? '已拒绝' : '待审核';
        markdown += `| ${routeName} | ${override.originalGrade} | ${override.newGrade} | ${override.coachName} | ${statusLabel} | ${override.timestamp} |\n`;
      }
      markdown += `\n`;
    }
  }

  markdown += `---\n\n`;
  markdown += `## 八、换线建议\n\n`;
  markdown += `根据以上数据分析，建议在下一次换线会议中重点讨论以下内容：\n\n`;
  
  const lowRateRoutes = [...routes]
    .map(route => ({ route, stats: statsMap.get(route.id)! }))
    .filter(({ stats }) => stats && stats.successRate < 20 && stats.totalAttempts > 5)
    .sort((a, b) => a.stats.successRate - b.stats.successRate);
  
  if (lowRateRoutes.length > 0) {
    markdown += `### 8.1 建议重新评估的线路\n\n`;
    for (const { route, stats } of lowRateRoutes.slice(0, 3)) {
      markdown += `- **${route.name}** (${route.difficulty}, ${route.zone})\n`;
      markdown += `  - 完攀率: ${stats.successRate.toFixed(1)}%, 尝试次数: ${stats.totalAttempts}\n`;
      markdown += `  - 建议: 检查线路设置是否合理，考虑调整难度标注\n\n`;
    }
  }
  
  const highCongestionRoutes = [...routes]
    .map(route => ({ route, stats: statsMap.get(route.id)! }))
    .filter(({ stats }) => stats && stats.congestionRisk === 'high')
    .sort((a, b) => b.stats.totalAttempts - a.stats.totalAttempts);
  
  if (highCongestionRoutes.length > 0) {
    markdown += `### 8.2 拥堵风险高的区域\n\n`;
    const zoneCongestion: Record<string, number> = {};
    for (const { route } of highCongestionRoutes) {
      zoneCongestion[route.zone] = (zoneCongestion[route.zone] || 0) + 1;
    }
    for (const [zone, count] of Object.entries(zoneCongestion)) {
      markdown += `- **${zone}**: ${count} 条线路拥堵风险高\n`;
    }
    markdown += `\n建议: 考虑在这些区域增加类似难度的线路，或调整高峰时段引导\n\n`;
  }
  
  markdown += `### 8.3 其他建议\n\n`;
  markdown += `- 热门时段数据显示最繁忙时段为 ${Object.entries(allTimeSlots).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([hour]) => `${parseInt(hour)}:00`).join('、')}，建议在这些时段增加教练巡场\n\n`;
  markdown += `---\n\n`;
  markdown += `**报告生成完毕**\n`;
  markdown += `*本报告基于当前导入的数据分析生成，仅供参考。建议结合实际情况进行决策。*\n`;

  return markdown;
};

export const generateJSONExport = (
  appData: AppData,
  options: ExportOptions
): string => {
  const exportData: any = {};
  
  if (options.includeRoutes) {
    exportData.routes = appData.routes;
  }
  
  if (options.includeStats) {
    exportData.memberFlows = appData.memberFlows;
    exportData.ascents = appData.ascents;
    
    const statsMap = processAllRoutes(appData);
    exportData.routeStats = Array.from(statsMap.values());
  }
  
  if (options.includeNotes) {
    exportData.incidentNotes = appData.incidentNotes;
    exportData.coachNotes = appData.coachNotes;
    exportData.gradeOverrides = appData.gradeOverrides;
  }
  
  if (options.includeAlerts) {
    exportData.alerts = appData.alerts;
  }
  
  exportData.exportMetadata = {
    exportTime: new Date().toISOString(),
    exportOptions: options,
    dataLastUpdated: appData.lastUpdated
  };
  
  return JSON.stringify(exportData, null, 2);
};

export const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

export const downloadMarkdownReport = (
  appData: AppData,
  options: ExportOptions
): void => {
  const content = generateMarkdownReport(appData, options);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `攀岩馆线路复盘报告_${dateStr}.md`;
  
  downloadFile(content, filename, 'text/markdown');
};

export const downloadJSONExport = (
  appData: AppData,
  options: ExportOptions
): void => {
  const content = generateJSONExport(appData, options);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `攀岩馆数据明细_${dateStr}.json`;
  
  downloadFile(content, filename, 'application/json');
};
