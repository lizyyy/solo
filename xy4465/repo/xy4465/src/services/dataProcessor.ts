import type { 
  Route, 
  MemberFlow, 
  Ascent, 
  RouteStats, 
  TimeSlotData, 
  Alert,
  AppData
} from '../types';
import { generateId } from './importService';

export const processRouteStats = (
  route: Route,
  ascents: Ascent[],
  memberFlows: MemberFlow[],
  allRoutes: Route[]
): RouteStats => {
  const routeAscents = ascents.filter(a => a.routeId === route.id);
  const successfulAscents = routeAscents.filter(a => a.success);
  const uniqueMemberIds = new Set(routeAscents.map(a => a.memberId));
  
  const timeSlots = calculatePopularTimeSlots(routeAscents, memberFlows);
  const congestionRisk = calculateCongestionRisk(timeSlots, routeAscents.length, allRoutes.length);
  
  const successRate = routeAscents.length > 0 
    ? (successfulAscents.length / routeAscents.length) * 100 
    : 0;
  
  const avgAttemptsPerSuccess = successfulAscents.length > 0
    ? successfulAscents.reduce((sum, a) => sum + (a.attempts || 1), 0) / successfulAscents.length
    : 0;
  
  const recentTrend = calculateRecentTrend(routeAscents);

  return {
    routeId: route.id,
    totalAttempts: routeAscents.length,
    successfulAscents: successfulAscents.length,
    successRate: Math.round(successRate * 100) / 100,
    popularTimeSlots: timeSlots,
    congestionRisk,
    avgAttemptsPerSuccess: Math.round(avgAttemptsPerSuccess * 100) / 100,
    uniqueClimbers: uniqueMemberIds.size,
    recentTrend
  };
};

const calculatePopularTimeSlots = (
  routeAscents: Ascent[],
  memberFlows: MemberFlow[]
): TimeSlotData[] => {
  const hourCounts: Record<number, number> = {};
  
  for (const ascent of routeAscents) {
    try {
      const date = new Date(ascent.timestamp);
      const hour = date.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    } catch (e) {
      continue;
    }
  }
  
  for (const flow of memberFlows) {
    try {
      const date = new Date(flow.checkInTime);
      const hour = date.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    } catch (e) {
      continue;
    }
  }
  
  const totalCount = Object.values(hourCounts).reduce((sum, count) => sum + count, 0);
  
  const timeSlots: TimeSlotData[] = Object.entries(hourCounts)
    .map(([hourStr, count]) => ({
      hour: parseInt(hourStr),
      count,
      percentage: totalCount > 0 ? (count / totalCount) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return timeSlots.map(ts => ({
    ...ts,
    percentage: Math.round(ts.percentage * 100) / 100
  }));
};

const calculateCongestionRisk = (
  timeSlots: TimeSlotData[],
  totalAscents: number,
  totalRoutes: number
): 'low' | 'medium' | 'high' => {
  if (timeSlots.length === 0 || totalAscents === 0) return 'low';
  
  const peakPercentage = timeSlots[0].percentage;
  const avgAscentsPerRoute = totalAscents / Math.max(totalRoutes, 1);
  
  if (peakPercentage > 40 || avgAscentsPerRoute > 20) {
    return 'high';
  } else if (peakPercentage > 25 || avgAscentsPerRoute > 10) {
    return 'medium';
  }
  
  return 'low';
};

const calculateRecentTrend = (ascents: Ascent[]): 'improving' | 'declining' | 'stable' => {
  if (ascents.length < 10) return 'stable';
  
  const sortedAscents = [...ascents].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const midPoint = Math.floor(sortedAscents.length / 2);
  const firstHalf = sortedAscents.slice(0, midPoint);
  const secondHalf = sortedAscents.slice(midPoint);
  
  const firstHalfRate = firstHalf.filter(a => a.success).length / firstHalf.length;
  const secondHalfRate = secondHalf.filter(a => a.success).length / secondHalf.length;
  
  const rateDiff = secondHalfRate - firstHalfRate;
  
  if (Math.abs(rateDiff) < 0.05) {
    return 'stable';
  } else if (rateDiff > 0) {
    return 'improving';
  } else {
    return 'declining';
  }
};

export const generateAlerts = (
  appData: AppData
): Alert[] => {
  const alerts: Alert[] = [];
  const { routes, ascents, incidentNotes, memberFlows } = appData;
  
  for (const route of routes) {
    const routeAscents = ascents.filter(a => a.routeId === route.id);
    const routeStats = processRouteStats(route, ascents, memberFlows, routes);
    
    if (routeStats.successRate < 10 && routeStats.totalAttempts > 5) {
      alerts.push({
        id: generateId(),
        type: 'warning',
        routeId: route.id,
        message: `线路 "${route.name}" 完攀率过低`,
        details: `该线路完攀率仅为 ${routeStats.successRate}%，共 ${routeStats.totalAttempts} 次尝试。可能需要重新评估难度或检查线路设置。`,
        timestamp: new Date().toISOString(),
        severity: 'high',
        acknowledged: false
      });
    }
    
    if (routeStats.avgAttemptsPerSuccess > 5 && routeStats.successfulAscents > 3) {
      alerts.push({
        id: generateId(),
        type: 'warning',
        routeId: route.id,
        message: `线路 "${route.name}" 平均尝试次数过高`,
        details: `成功完攀平均需要 ${routeStats.avgAttemptsPerSuccess.toFixed(1)} 次尝试，远超正常范围。可能需要调整难度标注。`,
        timestamp: new Date().toISOString(),
        severity: 'medium',
        acknowledged: false
      });
    }
    
    if (routeStats.congestionRisk === 'high') {
      alerts.push({
        id: generateId(),
        type: 'info',
        routeId: route.id,
        message: `线路 "${route.name}" 拥堵风险高`,
        details: `该线路在 ${routeStats.popularTimeSlots[0]?.hour}:00 时段最为热门，占比 ${routeStats.popularTimeSlots[0]?.percentage}%。建议在高峰时段增加引导或增加类似线路。`,
        timestamp: new Date().toISOString(),
        severity: 'medium',
        acknowledged: false
      });
    }
    
    const failedAttempts = routeAscents.filter(a => !a.success);
    const recentFailures = failedAttempts.filter(a => {
      try {
        const date = new Date(a.timestamp);
        const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo < 7;
      } catch (e) {
        return false;
      }
    });
    
    if (recentFailures.length > 10) {
      alerts.push({
        id: generateId(),
        type: 'error',
        routeId: route.id,
        message: `线路 "${route.name}" 近期失败率激增`,
        details: `近7天内有 ${recentFailures.length} 次失败尝试，可能存在线路磨损、难点不清晰或难度标注不准确等问题。`,
        timestamp: new Date().toISOString(),
        severity: 'high',
        acknowledged: false
      });
    }
  }
  
  const routeIncidents = incidentNotes.filter(n => n.type === 'injury' && n.status !== 'resolved');
  for (const incident of routeIncidents) {
    alerts.push({
      id: generateId(),
      type: 'error',
      routeId: incident.routeId,
      message: `存在未解决的伤情记录：${incident.title}`,
      details: `发生时间: ${incident.timestamp}\n严重程度: ${incident.severity}\n描述: ${incident.description}`,
      timestamp: new Date().toISOString(),
      severity: 'high',
      acknowledged: false
    });
  }
  
  const openComplaints = incidentNotes.filter(n => n.type === 'complaint' && n.status !== 'resolved');
  if (openComplaints.length > 0) {
    alerts.push({
      id: generateId(),
      type: 'warning',
      message: `有 ${openComplaints.length} 条未处理的投诉`,
      details: openComplaints.map(c => `- ${c.title} (${c.timestamp})`).join('\n'),
      timestamp: new Date().toISOString(),
      severity: 'medium',
      acknowledged: false
    });
  }
  
  const memberFlowDates = memberFlows.map(f => {
    try {
      return new Date(f.checkInTime);
    } catch (e) {
      return null;
    }
  }).filter(d => d !== null) as Date[];
  
  if (memberFlowDates.length > 0) {
    const latestFlow = new Date(Math.max(...memberFlowDates.map(d => d.getTime())));
    const daysSinceLastFlow = (Date.now() - latestFlow.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastFlow > 7) {
      alerts.push({
        id: generateId(),
        type: 'info',
        message: '数据更新提醒',
        details: `最近的会员数据是 ${Math.round(daysSinceLastFlow)} 天前的，建议导入最新数据以获得准确的分析。`,
        timestamp: new Date().toISOString(),
        severity: 'low',
        acknowledged: false
      });
    }
  }
  
  return alerts;
};

export const processAllRoutes = (appData: AppData): Map<string, RouteStats> => {
  const statsMap = new Map<string, RouteStats>();
  
  for (const route of appData.routes) {
    const stats = processRouteStats(
      route, 
      appData.ascents, 
      appData.memberFlows,
      appData.routes
    );
    statsMap.set(route.id, stats);
  }
  
  return statsMap;
};

export const formatTimeSlot = (timeSlot: TimeSlotData): string => {
  const startHour = timeSlot.hour;
  const endHour = (startHour + 1) % 24;
  return `${startHour.toString().padStart(2, '0')}:00 - ${endHour.toString().padStart(2, '0')}:00`;
};

export const getCongestionRiskLabel = (risk: 'low' | 'medium' | 'high'): string => {
  switch (risk) {
    case 'low': return '低';
    case 'medium': return '中';
    case 'high': return '高';
  }
};

export const getTrendLabel = (trend: 'improving' | 'declining' | 'stable'): string => {
  switch (trend) {
    case 'improving': return '上升';
    case 'declining': return '下降';
    case 'stable': return '稳定';
  }
};

export const filterRoutes = (
  routes: Route[],
  filters: {
    difficulties?: string[];
    zones?: string[];
    searchText?: string;
  }
): Route[] => {
  return routes.filter(route => {
    if (filters.difficulties && filters.difficulties.length > 0) {
      if (!filters.difficulties.includes(route.difficulty)) {
        return false;
      }
    }
    
    if (filters.zones && filters.zones.length > 0) {
      if (!filters.zones.includes(route.zone)) {
        return false;
      }
    }
    
    if (filters.searchText && filters.searchText.trim()) {
      const searchLower = filters.searchText.toLowerCase().trim();
      if (!route.name.toLowerCase().includes(searchLower) &&
          !route.difficulty.toLowerCase().includes(searchLower) &&
          !route.zone.toLowerCase().includes(searchLower) &&
          !route.setter?.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    
    return true;
  });
};

export const sortRoutes = (
  routes: Route[],
  statsMap: Map<string, RouteStats>,
  sortBy: 'name' | 'difficulty' | 'successRate' | 'popularity',
  sortOrder: 'asc' | 'desc'
): Route[] => {
  const sortedRoutes = [...routes];
  
  sortedRoutes.sort((a, b) => {
    let comparison = 0;
    const statsA = statsMap.get(a.id);
    const statsB = statsMap.get(b.id);
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name, 'zh-CN');
        break;
      case 'difficulty':
        const difficultyOrder = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10+', '未知'];
        const indexA = difficultyOrder.indexOf(a.difficulty);
        const indexB = difficultyOrder.indexOf(b.difficulty);
        comparison = indexA - indexB;
        break;
      case 'successRate':
        comparison = (statsA?.successRate || 0) - (statsB?.successRate || 0);
        break;
      case 'popularity':
        comparison = (statsA?.totalAttempts || 0) - (statsB?.totalAttempts || 0);
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  return sortedRoutes;
};
