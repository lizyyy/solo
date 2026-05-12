import { serviceDAO, endpointDAO, budgetRuleDAO, metricDAO, exceptionDAO, freezeDAO } from '../db/dao.js';
import type { MetricPoint } from '../types/index.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MINUTE_MS = 60 * 1000;

interface SampleService {
  name: string;
  description: string;
  owner: string;
  sloPercent: number;
  budgetPercent: number;
  windowDays: number;
  endpoints: { method: string; path: string; description: string }[];
  errorPattern: 'spike' | 'gradual' | 'sustained_high';
}

const sampleServices: SampleService[] = [
  {
    name: 'payment-service',
    description: '支付服务，处理所有支付相关请求',
    owner: '张三',
    sloPercent: 99.9,
    budgetPercent: 0.1,
    windowDays: 7,
    endpoints: [
      { method: 'POST', path: '/api/payments', description: '创建支付订单' },
      { method: 'GET', path: '/api/payments/:id', description: '查询支付状态' },
      { method: 'POST', path: '/api/payments/:id/refund', description: '退款' },
    ],
    errorPattern: 'spike',
  },
  {
    name: 'search-service',
    description: '搜索服务，提供商品搜索功能',
    owner: '李四',
    sloPercent: 99.5,
    budgetPercent: 0.5,
    windowDays: 7,
    endpoints: [
      { method: 'GET', path: '/api/search', description: '商品搜索' },
      { method: 'GET', path: '/api/search/suggestions', description: '搜索建议' },
    ],
    errorPattern: 'gradual',
  },
  {
    name: 'report-service',
    description: '报表服务，生成各类业务报表',
    owner: '王五',
    sloPercent: 99.0,
    budgetPercent: 1.0,
    windowDays: 30,
    endpoints: [
      { method: 'POST', path: '/api/reports', description: '创建报表任务' },
      { method: 'GET', path: '/api/reports/:id', description: '查询报表状态' },
      { method: 'GET', path: '/api/reports/:id/download', description: '下载报表' },
    ],
    errorPattern: 'sustained_high',
  },
];

export function generateSampleData(now: number = Date.now()): void {
  for (const svc of sampleServices) {
    const existing = serviceDAO.getAll().find(s => s.name === svc.name);
    if (existing) continue;
    
    const service = serviceDAO.create({
      name: svc.name,
      description: svc.description,
      owner: svc.owner,
    });
    
    for (const ep of svc.endpoints) {
      endpointDAO.create({
        serviceId: service.id,
        method: ep.method,
        path: ep.path,
        description: ep.description,
      });
    }
    
    budgetRuleDAO.create({
      serviceId: service.id,
      endpointId: null,
      name: `${svc.name} 默认规则`,
      description: `服务级 SLO: ${svc.sloPercent}%`,
      sloPercent: svc.sloPercent,
      budgetPercent: svc.budgetPercent,
      windowDays: svc.windowDays,
      burnRateThreshold1: 2,
      burnRateThreshold2: 10,
      spikeWindowMinutes: 15,
      spikeSustainedMinutes: 60,
      isActive: true,
    });
    
    const metrics = generateMetrics(service.id, null, svc.errorPattern, now, svc.windowDays, svc.budgetPercent);
    metricDAO.insertBatch(metrics);
  }
  
  addExceptionAndFreezeSamples(now);
}

function generateMetrics(
  serviceId: string,
  endpointId: string | null,
  pattern: SampleService['errorPattern'],
  now: number,
  windowDays: number,
  budgetPercent: number
): Omit<MetricPoint, 'id' | 'createdAt'>[] {
  const metrics: Omit<MetricPoint, 'id' | 'createdAt'>[] = [];
  const intervalMs = 5 * MINUTE_MS;
  const startTime = now - windowDays * DAY_MS;
  
  const totalIntervals = Math.floor((now - startTime) / intervalMs);
  const requestsPerInterval = 500;
  
  const budgetFraction = budgetPercent / 100;
  
  for (let i = 0; i < totalIntervals; i++) {
    const t = startTime + i * intervalMs;
    const dayProgress = i / totalIntervals;
    const hoursFromNow = (now - t) / HOUR_MS;
    
    let errorRateFraction = 0;
    
    switch (pattern) {
      case 'spike':
        errorRateFraction = budgetFraction * 0.8;
        if (hoursFromNow >= 1 && hoursFromNow <= 3) {
          errorRateFraction = budgetFraction * 25;
        }
        break;
        
      case 'gradual':
        const startFraction = budgetFraction * 0.5;
        const endFraction = budgetFraction * 4;
        errorRateFraction = startFraction + (endFraction - startFraction) * dayProgress;
        errorRateFraction *= (0.9 + Math.random() * 0.2);
        break;
        
      case 'sustained_high':
        errorRateFraction = budgetFraction * 0.5;
        if (hoursFromNow <= 4) {
          errorRateFraction = budgetFraction * 50;
        }
        break;
    }
    
    errorRateFraction = Math.max(0, Math.min(1, errorRateFraction));
    
    const errorRequests = Math.floor(requestsPerInterval * errorRateFraction);
    
    metrics.push({
      serviceId,
      endpointId,
      timestamp: t,
      totalRequests: requestsPerInterval,
      errorRequests,
      p50LatencyMs: 50 + Math.floor(Math.random() * 100),
      p99LatencyMs: 200 + Math.floor(Math.random() * 300),
      source: 'generated',
    });
  }
  
  return metrics;
}

function addExceptionAndFreezeSamples(now: number): void {
  const services = serviceDAO.getAll();
  
  const reportService = services.find(s => s.name === 'report-service');
  if (reportService) {
    const activeFreezes = freezeDAO.getActiveByService(reportService.id);
    if (activeFreezes.length === 0) {
      freezeDAO.create({
        serviceId: reportService.id,
        endpointId: null,
        reason: 'sustained_burn',
        reasonDetail: '报表服务检测到持续 4 小时高错误率燃烧，错误率从正常水平升至 8-12%',
        triggeredBy: 'system',
        isActive: true,
      });
    }
  }
  
  const searchService = services.find(s => s.name === 'search-service');
  if (searchService) {
    const activeExceptions = exceptionDAO.getActiveApproved(searchService.id, now);
    if (activeExceptions.length === 0) {
      exceptionDAO.create({
        serviceId: searchService.id,
        endpointId: null,
        releaseId: 'RELEASE-20260512-001',
        reason: '搜索服务紧急安全补丁发布，经过完整回归测试',
        requestedBy: '李四',
        approvedBy: 'SRE负责人',
        status: 'approved',
        expiresAt: now + 2 * HOUR_MS,
      });
    }
  }
}
