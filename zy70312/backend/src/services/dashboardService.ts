import { serviceDAO, endpointDAO, budgetRuleDAO, metricDAO, exceptionDAO, freezeDAO } from '../db/dao.js';
import { calculateBudgetConsumption, calculateTrend, checkMetricsGap } from './budgetEngine.js';
import type { Service, BudgetConsumption, RiskItem, MetricsGap, TrendPoint, FreezeRecord } from '../types/index.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface ServiceDashboard {
  service: Service;
  consumption: BudgetConsumption | null;
  status: 'healthy' | 'warning' | 'critical' | 'frozen' | 'missing_metrics';
  decision: 'continue' | 'observe' | 'freeze' | 'needs_exception';
  activeFreezes: FreezeRecord[];
  hasActiveException: boolean;
  metricsGap: { hasGap: boolean; gapHours: number } | null;
}

export interface DetailedDashboard extends ServiceDashboard {
  trend: TrendPoint[];
  reasons: string[];
  recommendations: string[];
}

export function getOverview(now: number = Date.now()): ServiceDashboard[] {
  const services = serviceDAO.getAll();
  const rules = budgetRuleDAO.getAllActive();
  const results: ServiceDashboard[] = [];
  
  for (const service of services) {
    const serviceRules = rules.filter(r => r.serviceId === service.id && r.endpointId === null);
    
    let consumption: BudgetConsumption | null = null;
    let status: ServiceDashboard['status'] = 'missing_metrics';
    let decision: ServiceDashboard['decision'] = 'needs_exception';
    let metricsGap: ServiceDashboard['metricsGap'] = null;
    
    if (serviceRules.length > 0) {
      const rule = serviceRules[0];
      const metrics = metricDAO.getByServiceTimeRange(
        service.id,
        now - rule.windowDays * DAY_MS,
        now
      );
      
      const lastMetric = metricDAO.getLastForService(service.id);
      metricsGap = checkMetricsGap(lastMetric, now);
      
      consumption = calculateBudgetConsumption({ rule, metrics, now });
      
      if (metricsGap.hasGap) {
        status = 'missing_metrics';
        decision = 'needs_exception';
      } else if (consumption) {
        status = consumption.status;
        decision = consumption.decision;
      }
    }
    
    const activeFreezes = freezeDAO.getActiveByService(service.id);
    if (activeFreezes.length > 0) {
      status = 'frozen';
      decision = 'freeze';
    }
    
    const activeExceptions = exceptionDAO.getActiveApproved(service.id, now);
    
    results.push({
      service,
      consumption,
      status,
      decision,
      activeFreezes,
      hasActiveException: activeExceptions.length > 0,
      metricsGap,
    });
  }
  
  return results;
}

export function getServiceDetail(serviceId: string, now: number = Date.now()): DetailedDashboard | null {
  const service = serviceDAO.getById(serviceId);
  if (!service) return null;
  
  const rules = budgetRuleDAO.getByService(serviceId);
  const serviceRule = rules.find(r => r.endpointId === null);
  
  let consumption: BudgetConsumption | null = null;
  let status: DetailedDashboard['status'] = 'missing_metrics';
  let decision: DetailedDashboard['decision'] = 'needs_exception';
  let trend: TrendPoint[] = [];
  let metricsGap: DetailedDashboard['metricsGap'] = null;
  
  if (serviceRule) {
    const metrics = metricDAO.getByServiceTimeRange(
      serviceId,
      now - serviceRule.windowDays * DAY_MS,
      now
    );
    
    const lastMetric = metricDAO.getLastForService(serviceId);
    metricsGap = checkMetricsGap(lastMetric, now);
    
    consumption = calculateBudgetConsumption({ rule: serviceRule, metrics, now });
    trend = calculateTrend(metrics, serviceRule, now);
    
    if (metricsGap.hasGap) {
      status = 'missing_metrics';
      decision = 'needs_exception';
    } else if (consumption) {
      status = consumption.status;
      decision = consumption.decision;
    }
  }
  
  const activeFreezes = freezeDAO.getActiveByService(serviceId);
  if (activeFreezes.length > 0) {
    status = 'frozen';
    decision = 'freeze';
  }
  
  const activeExceptions = exceptionDAO.getActiveApproved(serviceId, now);
  
  const reasons = generateReasons(status, consumption, activeFreezes, metricsGap);
  const recommendations = generateRecommendations(status, decision, consumption, activeExceptions.length > 0);
  
  return {
    service,
    consumption,
    status,
    decision,
    activeFreezes,
    hasActiveException: activeExceptions.length > 0,
    metricsGap,
    trend,
    reasons,
    recommendations,
  };
}

function generateReasons(
  status: string,
  consumption: BudgetConsumption | null,
  activeFreezes: FreezeRecord[],
  metricsGap: { hasGap: boolean; gapHours: number } | null
): string[] {
  const reasons: string[] = [];
  
  if (metricsGap?.hasGap) {
    reasons.push(`指标缺失超过 ${metricsGap.gapHours === Infinity ? '2' : Math.round(metricsGap.gapHours)} 小时，需要确认指标上报是否正常`);
  }
  
  if (activeFreezes.length > 0) {
    for (const freeze of activeFreezes) {
      reasons.push(`发布冻结中: ${freeze.reasonDetail}`);
    }
  }
  
  if (consumption) {
    if (consumption.remainingPercent <= 0) {
      reasons.push('错误预算已耗尽');
    } else if (consumption.remainingPercent <= 10) {
      reasons.push(`错误预算剩余不足 10% (当前: ${consumption.remainingPercent.toFixed(1)}%)`);
    } else if (consumption.remainingPercent <= 30) {
      reasons.push(`错误预算剩余 ${consumption.remainingPercent.toFixed(1)}%`);
    }
    
    if (consumption.burnRateLevel === 'critical') {
      reasons.push(`燃烧速度严重超标: ${consumption.burnRate.toFixed(2)}x`);
    } else if (consumption.burnRateLevel === 'warning') {
      reasons.push(`燃烧速度偏高: ${consumption.burnRate.toFixed(2)}x`);
    }
    
    if (consumption.isSustainedBurn) {
      reasons.push('检测到持续高错误率燃烧');
    }
    
    if (consumption.isSpike) {
      reasons.push('检测到短时错误率尖峰');
    }
  }
  
  if (reasons.length === 0 && status === 'healthy') {
    reasons.push('服务状态正常，错误预算充足');
  }
  
  return reasons;
}

function generateRecommendations(
  status: string,
  decision: string,
  consumption: BudgetConsumption | null,
  hasActiveException: boolean
): string[] {
  const recommendations: string[] = [];
  
  if (status === 'missing_metrics') {
    recommendations.push('立即检查指标采集服务和上报链路');
    recommendations.push('在确认指标正常前，发布需经过例外审批');
    return recommendations;
  }
  
  if (status === 'frozen') {
    recommendations.push('禁止所有发布，直到问题根因修复并验证');
    recommendations.push('如确需紧急发布，请申请例外审批');
    return recommendations;
  }
  
  switch (decision) {
    case 'freeze':
      recommendations.push('立即冻结该服务的所有发布');
      recommendations.push('优先排查近期变更和根因');
      break;
      
    case 'needs_exception':
      if (hasActiveException) {
        recommendations.push('存在有效例外审批，可继续发布');
      } else {
        recommendations.push('如需发布，请先申请例外审批');
      }
      recommendations.push('密切关注错误率和预算消耗趋势');
      break;
      
    case 'observe':
      recommendations.push('可以发布，但发布后需密切观察 30 分钟');
      recommendations.push('关注错误率和燃烧速度变化');
      if (consumption?.isSpike) {
        recommendations.push('建议排查近期尖峰的根因');
      }
      break;
      
    case 'continue':
      recommendations.push('可以正常发布');
      recommendations.push('发布后保持常规监控');
      break;
  }
  
  return recommendations;
}

export function getMetricsGaps(now: number = Date.now()): MetricsGap[] {
  const services = serviceDAO.getAll();
  const endpoints = endpointDAO.getAll();
  const gaps: MetricsGap[] = [];
  
  for (const service of services) {
    const lastMetric = metricDAO.getLastForService(service.id);
    const gap = checkMetricsGap(lastMetric, now);
    
    if (gap.hasGap) {
      gaps.push({
        serviceId: service.id,
        serviceName: service.name,
        endpointId: null,
        endpointPath: null,
        lastSeenAt: lastMetric?.timestamp || null,
        gapDurationHours: gap.gapHours === Infinity ? -1 : Math.round(gap.gapHours),
      });
    }
    
    const serviceEndpoints = endpoints.filter(e => e.serviceId === service.id);
    for (const ep of serviceEndpoints) {
      const lastEpMetric = metricDAO.getLastForEndpoint(ep.id);
      const epGap = checkMetricsGap(lastEpMetric, now);
      
      if (epGap.hasGap) {
        gaps.push({
          serviceId: service.id,
          serviceName: service.name,
          endpointId: ep.id,
          endpointPath: `${ep.method} ${ep.path}`,
          lastSeenAt: lastEpMetric?.timestamp || null,
          gapDurationHours: epGap.gapHours === Infinity ? -1 : Math.round(epGap.gapHours),
        });
      }
    }
  }
  
  return gaps;
}

export function generateRiskList(now: number = Date.now()): RiskItem[] {
  const overview = getOverview(now);
  const riskItems: RiskItem[] = [];
  
  for (const item of overview) {
    const detail = getServiceDetail(item.service.id, now);
    if (!detail) continue;
    
    riskItems.push({
      serviceName: item.service.name,
      endpoint: '服务级',
      status: item.status,
      decision: item.decision,
      remainingBudget: item.consumption 
        ? `${item.consumption.remainingPercent.toFixed(1)}%` 
        : (item.metricsGap?.hasGap ? '指标缺失' : 'N/A'),
      burnRate: item.consumption?.burnRate.toFixed(2) + 'x' || 'N/A',
      reasons: detail.reasons,
      recommendations: detail.recommendations,
    });
  }
  
  return riskItems.sort((a, b) => {
    const priority: Record<string, number> = {
      frozen: 0,
      missing_metrics: 1,
      critical: 2,
      warning: 3,
      healthy: 4,
    };
    return (priority[a.status] ?? 5) - (priority[b.status] ?? 5);
  });
}

export function cleanupExpiredExceptions(now: number = Date.now()): number {
  const allExceptions = exceptionDAO.getAll();
  const expiredIds = allExceptions
    .filter(e => e.status === 'approved' && e.expiresAt <= now)
    .map(e => e.id);
  
  exceptionDAO.markExpired(expiredIds);
  return expiredIds.length;
}
