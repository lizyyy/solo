import { GameState, ExportData, TimelineSnapshot, GameEvent, DataSource, EVENT_LABELS } from '../types/game';
import { formatDateTime } from './time';

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

const serializeDates = (obj: unknown): unknown => {
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeDates);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, serializeDates(value)])
    );
  }
  return obj;
};

const collectDataSources = (state: GameState): Record<string, DataSource[]> => {
  const sources: Record<string, DataSource[]> = {
    ships: state.ships.map(s => s.source),
    berths: state.berths.map(b => b.source),
    tugs: state.tugs.map(t => t.source),
    weather: state.weatherForecast.map(w => w.source),
  };
  return sources;
};

const calculateMetrics = (state: GameState) => {
  const events = state.events;
  const scheduledShips = state.schedules.filter(s => s.status !== 'cancelled').length;
  const successfulBertthings = events.filter(e => e.type === 'berthing_success').length;
  
  const onTimeRate = scheduledShips > 0 ? successfulBertthings / scheduledShips : 0;
  
  const totalTugHours = state.tugs.length * 24;
  const usedTugHours = state.schedules.reduce((total, schedule) => {
    return total + schedule.tugIds.length * (schedule.estimatedDuration / 60);
  }, 0);
  const resourceUtilization = totalTugHours > 0 ? usedTugHours / totalTugHours : 0;
  
  const waitTimes = state.schedules.map(schedule => {
    const ship = state.ships.find(s => s.id === schedule.shipId);
    if (!ship) return 0;
    const waitMinutes = (schedule.plannedTime.getTime() - ship.eta.getTime()) / 60000;
    return Math.max(0, waitMinutes);
  });
  const averageWaitTime = waitTimes.length > 0 
    ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length 
    : 0;
  
  return {
    onTimeRate: Math.round(onTimeRate * 100) / 100,
    resourceUtilization: Math.round(resourceUtilization * 100) / 100,
    averageWaitTime: Math.round(averageWaitTime),
  };
};

const buildDecisionChain = (snapshots: TimelineSnapshot[], finalState: GameState) => {
  const decisions = finalState.auditLogs
    .filter(log => log.action === 'CREATE_SCHEDULE' || log.action === 'CANCEL_SCHEDULE')
    .map(log => {
      const scheduleId = (log.afterState as GameState)?.schedules
        .find(s => s.createdAt.getTime() === log.timestamp.getTime())?.id;
      
      const schedule = finalState.schedules.find(s => s.id === scheduleId);
      const ship = schedule ? finalState.ships.find(s => s.id === schedule.shipId) : null;
      
      const relatedEvents = finalState.events.filter(e => e.scheduleId === scheduleId);
      const impact = relatedEvents.length > 0 
        ? relatedEvents.map(e => EVENT_LABELS[e.type]).join(', ')
        : '暂无事件';
      
      const alternatives: string[] = [];
      if (ship && schedule) {
        const otherBerths = finalState.berths.filter(
          b => b.id !== schedule.berthId && 
               b.maxLength >= ship.length && 
               b.maxDraft >= ship.draft
        );
        if (otherBerths.length > 0) {
          alternatives.push(`可选泊位: ${otherBerths.map(b => b.name).join(', ')}`);
        }
        
        const otherTugs = finalState.tugs.filter(
          t => !schedule.tugIds.includes(t.id) && t.status !== 'refueling'
        );
        const totalOtherPower = otherTugs.reduce((sum, t) => sum + t.power, 0);
        if (totalOtherPower >= ship.tugRequired) {
          alternatives.push(`可使用其他拖轮组合满足 ${ship.tugRequired} 马力需求`);
        }
      }
      
      return {
        time: log.timestamp,
        action: log.action === 'CREATE_SCHEDULE' ? '创建调度计划' : '取消调度计划',
        impact,
        alternatives,
        reasoning: log.reason,
      };
    });
  
  return decisions;
};

export const generateExportData = (
  gameState: GameState,
  timelineSnapshots: TimelineSnapshot[]
): ExportData => {
  const metrics = calculateMetrics(gameState);
  const decisionChain = buildDecisionChain(timelineSnapshots, gameState);
  
  return {
    gameId: gameState.gameId,
    exportedAt: new Date(),
    finalState: gameState,
    timelineSnapshots,
    dataSources: collectDataSources(gameState),
    analysisReport: {
      missedWindows: gameState.events.filter(e => e.type === 'window_missed'),
      tugConflicts: gameState.events.filter(e => e.type === 'tug_conflict'),
      fuelIssues: gameState.events.filter(e => e.type === 'fuel_insufficient'),
      successfulBertthings: gameState.events.filter(e => e.type === 'berthing_success'),
      decisionChain,
      finalScore: gameState.score,
      efficiencyMetrics: metrics,
    },
  };
};

export const exportToJSON = (exportData: ExportData): void => {
  const serialized = serializeDates(exportData);
  const blob = new Blob([JSON.stringify(serialized, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `港口风浪靠泊赛_结果_${exportData.gameId}_${formatDateTime(exportData.exportedAt).replace(/[/:]/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToCSV = (exportData: ExportData): void => {
  const rows: string[][] = [];
  
  rows.push(['=== 港口风浪靠泊赛 结果报告 ===']);
  rows.push(['游戏ID', exportData.gameId]);
  rows.push(['导出时间', formatDateTime(exportData.exportedAt)]);
  rows.push(['最终得分', exportData.finalState.score.toString()]);
  rows.push([]);
  
  rows.push(['=== 效率指标 ===']);
  rows.push(['准时率', `${(exportData.analysisReport.efficiencyMetrics.onTimeRate * 100).toFixed(1)}%`]);
  rows.push(['资源利用率', `${(exportData.analysisReport.efficiencyMetrics.resourceUtilization * 100).toFixed(1)}%`]);
  rows.push(['平均等待时间', `${exportData.analysisReport.efficiencyMetrics.averageWaitTime}分钟`]);
  rows.push([]);
  
  rows.push(['=== 事件统计 ===']);
  rows.push(['靠泊成功', exportData.analysisReport.successfulBertthings.length.toString()]);
  rows.push(['错过窗口', exportData.analysisReport.missedWindows.length.toString()]);
  rows.push(['拖轮冲突', exportData.analysisReport.tugConflicts.length.toString()]);
  rows.push(['燃油不足', exportData.analysisReport.fuelIssues.length.toString()]);
  rows.push([]);
  
  rows.push(['=== 事件详情 ===']);
  rows.push(['时间', '类型', '描述', '关联船舶', '关联计划', '数据来源']);
  
  const sortedEvents = [...exportData.finalState.events].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
  
  sortedEvents.forEach(event => {
    const ship = exportData.finalState.ships.find(s => s.id === event.shipId);
    const source = ship?.source;
    
    rows.push([
      formatDateTime(event.timestamp),
      EVENT_LABELS[event.type],
      event.description,
      ship?.name || '-',
      event.scheduleId || '-',
      source ? `${source.file}:${source.line}` : '-',
    ]);
  });
  rows.push([]);
  
  rows.push(['=== 决策链 ===']);
  rows.push(['时间', '操作', '影响', '备选方案', '决策理由']);
  exportData.analysisReport.decisionChain.forEach(decision => {
    rows.push([
      formatDateTime(decision.time),
      decision.action,
      decision.impact,
      decision.alternatives.join('; '),
      decision.reasoning,
    ]);
  });
  rows.push([]);
  
  rows.push(['=== 数据溯源 ===']);
  Object.entries(exportData.dataSources).forEach(([type, sources]) => {
    rows.push([`--- ${type} ---`]);
    rows.push(['文件', '行号', '原始内容', '导入时间']);
    sources.forEach(source => {
      rows.push([
        source.file,
        source.line.toString(),
        source.rawContent,
        formatDateTime(source.importTimestamp),
      ]);
    });
    rows.push([]);
  });
  
  const csvContent = rows.map(row => 
    row.map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `港口风浪靠泊赛_结果_${exportData.gameId}_${formatDateTime(exportData.exportedAt).replace(/[/:]/g, '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const generateShareCode = (exportData: ExportData): string => {
  const summary = {
    gameId: exportData.gameId,
    score: exportData.finalState.score,
    metrics: exportData.analysisReport.efficiencyMetrics,
    events: {
      successful: exportData.analysisReport.successfulBertthings.length,
      missed: exportData.analysisReport.missedWindows.length,
      conflicts: exportData.analysisReport.tugConflicts.length,
      fuelIssues: exportData.analysisReport.fuelIssues.length,
    },
  };
  return btoa(encodeURIComponent(JSON.stringify(summary)));
};

export const createTimelineSnapshot = (
  state: GameState,
  eventsAtTime: GameEvent[]
): TimelineSnapshot => {
  const stateCopy = JSON.parse(JSON.stringify(serializeDates(state))) as GameState;
  return {
    timestamp: new Date(state.currentTime),
    state: stateCopy,
    events: [...eventsAtTime],
  };
};

export const calculateScoreImpact = (
  eventType: GameEvent['type'],
  shipPriority: string
): number => {
  const priorityMultiplier = shipPriority === 'high' ? 2 : shipPriority === 'medium' ? 1.5 : 1;
  
  switch (eventType) {
    case 'berthing_success':
      return Math.round(100 * priorityMultiplier);
    case 'window_missed':
      return Math.round(-150 * priorityMultiplier);
    case 'tug_conflict':
      return Math.round(-80 * priorityMultiplier);
    case 'fuel_insufficient':
      return Math.round(-50 * priorityMultiplier);
    default:
      return 0;
  }
};

export const generateAnalysisReport = (exportData: ExportData): string => {
  const { analysisReport } = exportData;
  const { efficiencyMetrics } = analysisReport;
  
  let report = `# 港口风浪靠泊赛 分析报告\n\n`;
  report += `游戏ID: ${exportData.gameId}\n`;
  report += `导出时间: ${formatDateTime(exportData.exportedAt)}\n`;
  report += `最终得分: ${exportData.finalState.score}\n\n`;
  
  report += `## 效率指标\n\n`;
  report += `- 准时率: ${(efficiencyMetrics.onTimeRate * 100).toFixed(1)}%\n`;
  report += `- 资源利用率: ${(efficiencyMetrics.resourceUtilization * 100).toFixed(1)}%\n`;
  report += `- 平均等待时间: ${efficiencyMetrics.averageWaitTime}分钟\n\n`;
  
  report += `## 事件统计\n\n`;
  report += `- ✅ 靠泊成功: ${analysisReport.successfulBertthings.length} 次\n`;
  report += `- ❌ 错过窗口: ${analysisReport.missedWindows.length} 次\n`;
  report += `- ⚠️  拖轮冲突: ${analysisReport.tugConflicts.length} 次\n`;
  report += `- 🛢️ 燃油不足: ${analysisReport.fuelIssues.length} 次\n\n`;
  
  if (analysisReport.missedWindows.length > 0) {
    report += `### 错过窗口详情\n\n`;
    analysisReport.missedWindows.forEach((event, idx) => {
      const ship = exportData.finalState.ships.find(s => s.id === event.shipId);
      report += `${idx + 1}. ${formatDateTime(event.timestamp)} - ${ship?.name || '未知船舶'}: ${event.description}\n`;
      report += `   数据来源: ${ship?.source.file}:${ship?.source.line}\n`;
      report += `   原始数据: ${ship?.source.rawContent}\n\n`;
    });
  }
  
  if (analysisReport.decisionChain.length > 0) {
    report += `## 决策链分析\n\n`;
    analysisReport.decisionChain.forEach((decision, idx) => {
      report += `### 决策 ${idx + 1}\n\n`;
      report += `- 时间: ${formatDateTime(decision.time)}\n`;
      report += `- 操作: ${decision.action}\n`;
      report += `- 影响: ${decision.impact}\n`;
      report += `- 理由: ${decision.reasoning}\n`;
      if (decision.alternatives.length > 0) {
        report += `- 备选方案:\n`;
        decision.alternatives.forEach(alt => {
          report += `  - ${alt}\n`;
        });
      }
      report += `\n`;
    });
  }
  
  return report;
};

export const exportReportToMarkdown = (exportData: ExportData): void => {
  const report = generateAnalysisReport(exportData);
  const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `港口风浪靠泊赛_分析报告_${exportData.gameId}_${formatDateTime(exportData.exportedAt).replace(/[/:]/g, '-')}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const generateGameId = (): string => {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  return `${dateStr}_${generateId().toUpperCase()}`;
};
