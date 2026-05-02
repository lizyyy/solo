import { 
  ParsedRequest, 
  PerformanceBudget, 
  AnalysisResult, 
  BudgetIssue, 
  BudgetIssueType,
  ResourceType
} from '@/types';
import { getPageTimings, formatBytes, formatMilliseconds } from './harParser';
import { HARFile } from '@/types';

const resourceTypes: ResourceType[] = ['document', 'stylesheet', 'script', 'image', 'font', 'media', 'xhr', 'fetch', 'websocket', 'other'];

const initializeResourceTypeStats = () => {
  const stats: any = {};
  for (const type of resourceTypes) {
    stats[type] = { count: 0, size: 0, transferSize: 0 };
  }
  return stats;
};

const calculateResourceTypeStats = (requests: ParsedRequest[]) => {
  const stats = initializeResourceTypeStats();
  
  for (const req of requests) {
    stats[req.resourceType].count += 1;
    stats[req.resourceType].size += req.responseSize;
    stats[req.resourceType].transferSize += req.transferSize;
  }
  
  return stats;
};

const calculateCacheStats = (requests: ParsedRequest[]) => {
  let hitCount = 0;
  let missCount = 0;
  let noneCount = 0;
  
  for (const req of requests) {
    if (req.cacheStatus === 'hit') {
      hitCount++;
    } else if (req.cacheStatus === 'miss') {
      missCount++;
    } else {
      noneCount++;
    }
  }
  
  const total = hitCount + missCount + noneCount;
  const hitRate = total > 0 ? (hitCount / total) * 100 : 0;
  
  return {
    hitCount,
    missCount,
    noneCount,
    hitRate,
  };
};

const calculateThirdPartyStats = (requests: ParsedRequest[]) => {
  const domainMap = new Map<string, { count: number; size: number }>();
  let totalCount = 0;
  let totalSize = 0;
  
  for (const req of requests) {
    if (req.isThirdParty) {
      const existing = domainMap.get(req.domain) || { count: 0, size: 0 };
      domainMap.set(req.domain, {
        count: existing.count + 1,
        size: existing.size + req.transferSize,
      });
      totalCount++;
      totalSize += req.transferSize;
    }
  }
  
  const domains = Array.from(domainMap.entries())
    .map(([domain, stats]) => ({ domain, ...stats }))
    .sort((a, b) => b.size - a.size);
  
  return {
    domains,
    totalCount,
    totalSize,
  };
};

const checkTotalRequests = (
  requests: ParsedRequest[], 
  budget: PerformanceBudget
): BudgetIssue | null => {
  const threshold = budget.thresholds.totalRequests;
  if (!threshold) return null;
  
  const actual = requests.length;
  if (actual > threshold) {
    return {
      type: 'total_requests',
      severity: 'error',
      title: '总请求数超出预算',
      description: `页面总请求数为 ${actual}，超出预算阈值 ${threshold}`,
      threshold,
      actual,
      requests,
    };
  }
  
  return null;
};

const checkTotalSize = (
  requests: ParsedRequest[], 
  budget: PerformanceBudget
): BudgetIssue | null => {
  const threshold = budget.thresholds.totalSize;
  if (!threshold) return null;
  
  const actual = requests.reduce((sum, req) => sum + req.transferSize, 0);
  if (actual > threshold) {
    return {
      type: 'total_size',
      severity: 'error',
      title: '总资源大小超出预算',
      description: `页面总传输大小为 ${formatBytes(actual)}，超出预算阈值 ${formatBytes(threshold)}`,
      threshold,
      actual,
      requests,
    };
  }
  
  return null;
};

const checkResourceTypes = (
  requests: ParsedRequest[], 
  budget: PerformanceBudget
): BudgetIssue[] => {
  const issues: BudgetIssue[] = [];
  const resourceTypeBudget = budget.thresholds.resourceTypes;
  
  if (!resourceTypeBudget) return issues;
  
  for (const [type, config] of Object.entries(resourceTypeBudget)) {
    const typeRequests = requests.filter(req => req.resourceType === type);
    const count = typeRequests.length;
    const size = typeRequests.reduce((sum, req) => sum + req.transferSize, 0);
    
    if (config?.count !== undefined && count > config.count) {
      issues.push({
        type: 'resource_type_count',
        severity: 'error',
        title: `${type} 类型资源数量超出预算`,
        description: `${type} 类型资源数量为 ${count}，超出预算阈值 ${config.count}`,
        threshold: config.count,
        actual: count,
        requests: typeRequests,
        resourceType: type as ResourceType,
      });
    }
    
    if (config?.size !== undefined && size > config.size) {
      issues.push({
        type: 'resource_type_size',
        severity: 'error',
        title: `${type} 类型资源大小超出预算`,
        description: `${type} 类型资源总大小为 ${formatBytes(size)}，超出预算阈值 ${formatBytes(config.size)}`,
        threshold: config.size,
        actual: size,
        requests: typeRequests,
        resourceType: type as ResourceType,
      });
    }
  }
  
  return issues;
};

const checkThirdParty = (
  requests: ParsedRequest[], 
  budget: PerformanceBudget
): BudgetIssue[] => {
  const issues: BudgetIssue[] = [];
  const thirdPartyConfig = budget.thresholds.thirdParty;
  
  if (!thirdPartyConfig) return issues;
  
  const thirdPartyRequests = requests.filter(req => req.isThirdParty);
  const count = thirdPartyRequests.length;
  const size = thirdPartyRequests.reduce((sum, req) => sum + req.transferSize, 0);
  
  if (thirdPartyConfig.count !== undefined && count > thirdPartyConfig.count) {
    issues.push({
      type: 'third_party_count',
      severity: 'warning',
      title: '第三方资源数量超出预算',
      description: `第三方资源数量为 ${count}，超出预算阈值 ${thirdPartyConfig.count}`,
      threshold: thirdPartyConfig.count,
      actual: count,
      requests: thirdPartyRequests,
    });
  }
  
  if (thirdPartyConfig.size !== undefined && size > thirdPartyConfig.size) {
    issues.push({
      type: 'third_party_size',
      severity: 'warning',
      title: '第三方资源大小超出预算',
      description: `第三方资源总大小为 ${formatBytes(size)}，超出预算阈值 ${formatBytes(thirdPartyConfig.size)}`,
      threshold: thirdPartyConfig.size,
      actual: size,
      requests: thirdPartyRequests,
    });
  }
  
  return issues;
};

const checkCache = (
  cacheStats: { hitCount: number; missCount: number; noneCount: number; hitRate: number },
  budget: PerformanceBudget
): BudgetIssue | null => {
  const cacheConfig = budget.thresholds.cache;
  
  if (!cacheConfig || cacheConfig.missRate === undefined) return null;
  
  const missRate = 100 - cacheStats.hitRate;
  if (missRate > cacheConfig.missRate) {
    return {
      type: 'cache_miss_rate',
      severity: 'warning',
      title: '缓存命中率低于预算',
      description: `缓存未命中率为 ${missRate.toFixed(2)}%，超出预算阈值 ${cacheConfig.missRate}%`,
      threshold: cacheConfig.missRate,
      actual: missRate,
    };
  }
  
  return null;
};

const checkDuplicateRequests = (requests: ParsedRequest[]): BudgetIssue[] => {
  const issues: BudgetIssue[] = [];
  const duplicateRequests = requests.filter(req => req.isDuplicate);
  
  if (duplicateRequests.length > 0) {
    const uniqueUrls = new Set(duplicateRequests.map(req => req.url));
    
    for (const url of uniqueUrls) {
      const urlRequests = duplicateRequests.filter(req => req.url === url);
      issues.push({
        type: 'duplicate_request',
        severity: 'warning',
        title: '检测到重复请求',
        description: `URL ${url} 被请求了 ${urlRequests[0].duplicateCount} 次`,
        requests: urlRequests,
      });
    }
  }
  
  return issues;
};

const checkMissingTiming = (requests: ParsedRequest[]): BudgetIssue | null => {
  const missingTimingRequests = requests.filter(req => req.hasMissingTiming);
  
  if (missingTimingRequests.length > 0) {
    return {
      type: 'missing_timing',
      severity: 'info',
      title: '部分请求缺少 timing 数据',
      description: `有 ${missingTimingRequests.length} 个请求缺少 timing 数据，时间分析可能不准确`,
      actual: missingTimingRequests.length,
      requests: missingTimingRequests,
    };
  }
  
  return null;
};

const checkLargeResources = (requests: ParsedRequest[], threshold: number = 500 * 1024): BudgetIssue[] => {
  const issues: BudgetIssue[] = [];
  const largeRequests = requests.filter(req => req.transferSize > threshold);
  
  for (const req of largeRequests) {
    issues.push({
      type: 'large_resource',
      severity: 'warning',
      title: '检测到大资源文件',
      description: `资源 ${req.url} 大小为 ${formatBytes(req.transferSize)}，超过建议阈值 ${formatBytes(threshold)}`,
      actual: req.transferSize,
      threshold,
      requests: [req],
      resourceType: req.resourceType,
    });
  }
  
  return issues;
};

const checkSlowResources = (requests: ParsedRequest[], threshold: number = 3000): BudgetIssue[] => {
  const issues: BudgetIssue[] = [];
  const slowRequests = requests.filter(req => req.totalTime > threshold && !req.isFromCache);
  
  for (const req of slowRequests) {
    issues.push({
      type: 'slow_resource',
      severity: 'warning',
      title: '检测到慢速资源',
      description: `资源 ${req.url} 加载耗时 ${formatMilliseconds(req.totalTime)}，超过建议阈值 ${formatMilliseconds(threshold)}`,
      actual: req.totalTime,
      threshold,
      requests: [req],
      resourceType: req.resourceType,
    });
  }
  
  return issues;
};

export const analyzePerformance = (
  harData: HARFile,
  parsedRequests: ParsedRequest[],
  budget: PerformanceBudget,
  warnings: string[]
): AnalysisResult => {
  const pageTimings = getPageTimings(harData);
  const resourceTypeStats = calculateResourceTypeStats(parsedRequests);
  const cacheStats = calculateCacheStats(parsedRequests);
  const thirdPartyStats = calculateThirdPartyStats(parsedRequests);
  
  const issues: BudgetIssue[] = [];
  
  const totalRequestsIssue = checkTotalRequests(parsedRequests, budget);
  if (totalRequestsIssue) issues.push(totalRequestsIssue);
  
  const totalSizeIssue = checkTotalSize(parsedRequests, budget);
  if (totalSizeIssue) issues.push(totalSizeIssue);
  
  issues.push(...checkResourceTypes(parsedRequests, budget));
  issues.push(...checkThirdParty(parsedRequests, budget));
  
  const cacheIssue = checkCache(cacheStats, budget);
  if (cacheIssue) issues.push(cacheIssue);
  
  issues.push(...checkDuplicateRequests(parsedRequests));
  
  const missingTimingIssue = checkMissingTiming(parsedRequests);
  if (missingTimingIssue) issues.push(missingTimingIssue);
  
  issues.push(...checkLargeResources(parsedRequests, 500 * 1024));
  issues.push(...checkSlowResources(parsedRequests, 3000));
  
  const totalSize = parsedRequests.reduce((sum, req) => sum + req.responseSize, 0);
  const totalTransferSize = parsedRequests.reduce((sum, req) => sum + req.transferSize, 0);
  
  const validTimeRequests = parsedRequests.filter(req => !req.hasMissingTiming && req.totalTime > 0);
  const longestRequest = validTimeRequests.length > 0 
    ? Math.max(...validTimeRequests.map(req => req.totalTime)) 
    : 0;
  const avgRequestTime = validTimeRequests.length > 0 
    ? validTimeRequests.reduce((sum, req) => sum + req.totalTime, 0) / validTimeRequests.length 
    : 0;
  
  const result: AnalysisResult = {
    pageInfo: {
      startedDateTime: harData.log.pages?.[0]?.startedDateTime || parsedRequests[0]?.rawEntry.startedDateTime || new Date().toISOString(),
      domContentLoadedTime: pageTimings.domContentLoaded,
      onLoadTime: pageTimings.onLoad,
      totalRequests: parsedRequests.length,
      totalSize,
      totalTransferSize,
    },
    requests: parsedRequests,
    resourceTypeStats,
    cacheStats,
    thirdPartyStats,
    issues,
    timingStats: {
      domContentLoaded: pageTimings.domContentLoaded,
      onLoad: pageTimings.onLoad,
      longestRequest,
      avgRequestTime,
    },
    warnings,
  };
  
  return result;
};

export const groupIssuesBySeverity = (issues: BudgetIssue[]): {
  errors: BudgetIssue[];
  warnings: BudgetIssue[];
  infos: BudgetIssue[];
} => {
  return {
    errors: issues.filter(i => i.severity === 'error'),
    warnings: issues.filter(i => i.severity === 'warning'),
    infos: issues.filter(i => i.severity === 'info'),
  };
};

export const groupIssuesByType = (issues: BudgetIssue[]): Map<BudgetIssueType, BudgetIssue[]> => {
  const grouped = new Map<BudgetIssueType, BudgetIssue[]>();
  
  for (const issue of issues) {
    if (!grouped.has(issue.type)) {
      grouped.set(issue.type, []);
    }
    grouped.get(issue.type)!.push(issue);
  }
  
  return grouped;
};
