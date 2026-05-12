import { v4 as uuidv4 } from 'uuid';
import store from '../store.js';
import { STAGES, updateBusinessStatus, updateDataSummary, addProblem } from '../utils/status.js';
import { getLatestHeatmap, getHeatmapById, HEAT_THRESHOLDS } from './heatmap.js';

const PATROL_STRATEGIES = {
  critical: {
    frequency: '15分钟/次',
    priority: 1,
    action: '重点巡视，关注人群密度和安全距离',
    securityLevel: 'high'
  },
  hot: {
    frequency: '30分钟/次',
    priority: 2,
    action: '定期巡查，保持监控',
    securityLevel: 'medium'
  },
  warm: {
    frequency: '60分钟/次',
    priority: 3,
    action: '常规巡逻，观察人流变化',
    securityLevel: 'low'
  },
  cold: {
    frequency: '90分钟/次',
    priority: 4,
    action: '简化巡逻，重点关注作品安全',
    securityLevel: 'minimal'
  }
};

function generatePatrolRecommendations(heatmapId = null) {
  updateBusinessStatus(STAGES.SECURITY_RECOMMENDATION, null, ['开始生成安保巡逻建议']);
  
  const heatmap = heatmapId ? getHeatmapById(heatmapId) : getLatestHeatmap();
  
  if (!heatmap) {
    updateBusinessStatus(
      STAGES.SECURITY_RECOMMENDATION, 
      'no_heatmap', 
      ['没有可用的热区数据，请先进行热区计算']
    );
    return { success: false, message: '没有可用的热区数据' };
  }
  
  const suggestions = [];
  const patrolPlan = buildPatrolPlan(heatmap);
  const routeOptimization = optimizePatrolRoute(patrolPlan.exhibitionPatrols);
  
  const recommendation = {
    id: uuidv4(),
    heatmapId: heatmap.id,
    timestamp: new Date().toISOString(),
    overallAssessment: assessOverallSecurity(heatmap),
    exhibitionPatrols: patrolPlan.exhibitionPatrols,
    patrolRoutes: routeOptimization.routes,
    patrolSchedule: buildPatrolSchedule(patrolPlan.exhibitionPatrols),
    alerts: patrolPlan.alerts,
    displaySuggestions: generateDisplaySuggestions(heatmap)
  };
  
  store.securityPatrols.push(recommendation);
  
  suggestions.push(`已生成 ${patrolPlan.exhibitionPatrols.length} 个展区的巡逻方案`);
  suggestions.push(`发现 ${patrolPlan.alerts.length} 个需要立即关注的安全警报`);
  
  if (patrolPlan.alerts.length > 0) {
    suggestions.push(`最高优先级展区: ${routeOptimization.highPriorityRoute.join(' → ')}`);
  }
  
  updateBusinessStatus(STAGES.COMPLETED, null, suggestions);
  
  return {
    success: true,
    recommendationId: recommendation.id,
    message: '安保巡逻建议生成完成',
    suggestions
  };
}

function buildPatrolPlan(heatmap) {
  const alerts = [];
  const exhibitionPatrols = [];
  
  for (const exHeat of heatmap.exhibitionHeat) {
    const strategy = PATROL_STRATEGIES[exHeat.heatLevel] || PATROL_STRATEGIES.warm;
    
    const patrol = {
      exhibitionId: exHeat.exhibitionId,
      exhibitionName: exHeat.exhibitionName,
      heatLevel: exHeat.heatLevel,
      heatScore: exHeat.heatScore,
      priority: exHeat.priority,
      visitorCount: exHeat.visitorCount,
      strategy: {
        frequency: strategy.frequency,
        priorityRank: strategy.priority,
        action: strategy.action,
        securityLevel: strategy.securityLevel
      },
      needsExtraAttention: false,
      recommendations: []
    };
    
    if (exHeat.heatLevel === 'critical') {
      patrol.needsExtraAttention = true;
      patrol.recommendations.push('建议增派安保人员，设置临时隔离带');
      patrol.recommendations.push('准备应急疏散预案');
      
      alerts.push({
        type: 'crowd_density',
        level: 'critical',
        exhibition: exHeat.exhibitionName,
        message: `极热区警报："${exHeat.exhibitionName}" 人群密度过高`,
        heatScore: exHeat.heatScore,
        visitorCount: exHeat.visitorCount
      });
    }
    
    if (exHeat.heatLevel === 'hot' && exHeat.priority === 'high') {
      patrol.needsExtraAttention = true;
      patrol.recommendations.push('高优先级展区热度较高，加强监控频率');
    }
    
    if (exHeat.visitorCount === 0) {
      patrol.recommendations.push('该展区无人停留，关注作品安全状况');
    }
    
    if (exHeat.deviatedFromExpected && exHeat.durationRatio > 1.5) {
      patrol.recommendations.push('观众停留时间超出预期，可能存在展品吸引点或人流瓶颈');
    }
    
    exhibitionPatrols.push(patrol);
  }
  
  exhibitionPatrols.sort((a, b) => a.strategy.priorityRank - b.strategy.priorityRank);
  
  return { exhibitionPatrols, alerts };
}

function optimizePatrolRoute(exhibitionPatrols) {
  const highPriority = exhibitionPatrols.filter(p => p.heatLevel === 'critical' || p.heatLevel === 'hot');
  const mediumPriority = exhibitionPatrols.filter(p => p.heatLevel === 'warm');
  const lowPriority = exhibitionPatrols.filter(p => p.heatLevel === 'cold');
  
  const exhibitions = store.exhibitions;
  
  const sortByPosition = (patrols) => {
    return patrols.sort((a, b) => {
      const exA = exhibitions.find(e => e.id === a.exhibitionId);
      const exB = exhibitions.find(e => e.id === b.exhibitionId);
      if (!exA || !exB) return 0;
      const centerA = exA.boundingBox.x + exA.boundingBox.width / 2;
      const centerB = exB.boundingBox.x + exB.boundingBox.width / 2;
      return centerA - centerB;
    });
  };
  
  const highPriorityRoute = sortByPosition(highPriority).map(p => p.exhibitionName);
  const mediumPriorityRoute = sortByPosition(mediumPriority).map(p => p.exhibitionName);
  const lowPriorityRoute = sortByPosition(lowPriority).map(p => p.exhibitionName);
  
  return {
    highPriorityRoute,
    mediumPriorityRoute,
    lowPriorityRoute,
    routes: {
      critical: highPriorityRoute,
      hot: highPriorityRoute,
      warm: mediumPriorityRoute,
      cold: lowPriorityRoute
    }
  };
}

function buildPatrolSchedule(exhibitionPatrols) {
  const schedule = [];
  const intervals = [
    { time: '09:00', label: '开馆初期' },
    { time: '11:00', label: '上午高峰' },
    { time: '14:00', label: '下午时段' },
    { time: '16:00', label: '傍晚时段' },
    { time: '17:30', label: '闭馆前' }
  ];
  
  for (const interval of intervals) {
    const criticalExhibitions = exhibitionPatrols.filter(p => p.heatLevel === 'critical');
    const hotExhibitions = exhibitionPatrols.filter(p => p.heatLevel === 'hot');
    const warmExhibitions = exhibitionPatrols.filter(p => p.heatLevel === 'warm');
    
    schedule.push({
      time: interval.time,
      label: interval.label,
      primaryPatrols: [
        ...criticalExhibitions.map(e => `${e.exhibitionName} (必巡)`),
        ...hotExhibitions.map(e => `${e.exhibitionName} (重点)`)
      ],
      secondaryPatrols: warmExhibitions.map(e => e.exhibitionName),
      notes: criticalExhibitions.length > 0 
        ? `${criticalExhibitions.length}个极热区需要重点关注` 
        : '常规巡逻'
    });
  }
  
  return schedule;
}

function assessOverallSecurity(heatmap) {
  const stats = heatmap.overallStats;
  
  if (stats.criticalCount > 0) {
    return {
      level: 'high_risk',
      color: '#f44336',
      description: '存在极热区域，安保压力较大',
      action: '建议立即增派安保人员'
    };
  }
  
  if (stats.hotCount >= stats.warmCount + stats.coldCount) {
    return {
      level: 'medium_risk',
      color: '#ff9800',
      description: '热区比例较高，需保持警惕',
      action: '维持现有安保配置，加强巡逻频率'
    };
  }
  
  if (stats.coldCount > stats.hotCount + stats.warmCount) {
    return {
      level: 'low_risk',
      color: '#1e88e5',
      description: '整体人流分布较均匀',
      action: '按常规计划巡逻，关注冷区展品安全'
    };
  }
  
  return {
    level: 'normal',
    color: '#4caf50',
    description: '安保状态正常',
    action: '按标准流程执行巡逻任务'
  };
}

function generateDisplaySuggestions(heatmap) {
  const suggestions = [];
  
  for (const exHeat of heatmap.exhibitionHeat) {
    if (exHeat.heatLevel === 'cold' && exHeat.priority === 'high') {
      suggestions.push({
        type: 'display_optimization',
        exhibition: exHeat.exhibitionName,
        priority: 'high',
        suggestion: '高优先级展区热度较低，建议优化展墙说明或调整展品位置'
      });
    }
    
    if (exHeat.deviatedFromExpected && exHeat.durationRatio > 1.5) {
      suggestions.push({
        type: 'crowd_management',
        exhibition: exHeat.exhibitionName,
        priority: 'medium',
        suggestion: '观众停留时间超出预期，可能需要增加说明牌或引导标识'
      });
    }
    
    if (exHeat.deviatedFromExpected && exHeat.durationRatio < 0.5) {
      suggestions.push({
        type: 'display_review',
        exhibition: exHeat.exhibitionName,
        priority: 'low',
        suggestion: '观众停留时间低于预期，建议评估展品吸引力'
      });
    }
  }
  
  return suggestions;
}

function getLatestRecommendation() {
  return store.securityPatrols.length > 0 
    ? store.securityPatrols[store.securityPatrols.length - 1] 
    : null;
}

function getRecommendationById(id) {
  return store.securityPatrols.find(r => r.id === id) || null;
}

export {
  generatePatrolRecommendations,
  getLatestRecommendation,
  getRecommendationById,
  PATROL_STRATEGIES
};
