const dayjs = require('dayjs');

function findTenantById(tenants, tenantId) {
  return tenants.find(t => t.id === tenantId);
}

function isTenantVipExempt(tenant) {
  return tenant && tenant.vipExempt === true;
}

function findInterfaceGroupByPath(groups, path) {
  return groups.find(g => 
    g.interfaces.some(i => path.startsWith(i) || path === i)
  );
}

function getMatchingRules(activeRules, tenant, regionCode, interfacePath, interfaceGroups) {
  const group = findInterfaceGroupByPath(interfaceGroups, interfacePath);
  const groupId = group ? group.id : null;
  
  return activeRules.filter(rule => {
    if (rule.interfaceGroupId && groupId !== rule.interfaceGroupId) {
      return false;
    }
    
    if (rule.regionCode && rule.regionCode !== 'DEFAULT') {
      if (regionCode !== rule.regionCode) {
        return false;
      }
    }
    
    if (rule.type === 'COMBINED' && rule.tenantLevel) {
      if (!tenant || tenant.level !== rule.tenantLevel) {
        return false;
      }
    }
    
    return true;
  }).sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

function evaluateRequest(request, activeRules, tenants, interfaceGroups, regions) {
  const { tenantId, regionCode, path, timestamp } = request;
  const result = {
    request,
    decision: 'ALLOW',
    matchedRules: [],
    explanations: [],
    vipExempted: false,
    effectiveRegion: null,
  };

  const tenant = findTenantById(tenants, tenantId);
  
  const matchingRules = getMatchingRules(activeRules, tenant, regionCode, path, interfaceGroups);
  
  if (matchingRules.length === 0) {
    result.explanations.push('无匹配限流规则，直接放行');
    return result;
  }

  for (const rule of matchingRules) {
    const ruleContext = {
      ruleId: rule.id,
      ruleName: rule.name,
      priority: rule.priority,
      region: regions.find(r => r.code === rule.regionCode)?.name || rule.regionCode,
    };

    if (isTenantVipExempt(tenant) && rule.vipExempt) {
      result.vipExempted = true;
      result.explanations.push(
        `规则 [${rule.name}] (优先级${rule.priority})：租户 [${tenant?.name || tenantId}] 为VIP且规则开启VIP豁免，跳过此规则`
      );
      continue;
    }

    result.matchedRules.push(ruleContext);
    result.effectiveRegion = ruleContext.region;
    
    const limitExceeded = simulateLimitCheck(rule, request);
    
    if (limitExceeded) {
      result.decision = rule.limitType === 'RATE' ? 'RATE_LIMITED' : 'REJECTED';
      result.explanations.push(
        `规则 [${rule.name}] (优先级${rule.priority})：触发${rule.limitType === 'QPS' ? 'QPS' : '访问量'}限制 (阈值: ${rule.limitValue}/${rule.windowSeconds}s)，${result.decision === 'RATE_LIMITED' ? '限速' : '拒绝'}`
      );
      break;
    } else {
      result.explanations.push(
        `规则 [${rule.name}] (优先级${rule.priority})：未超过阈值 (${rule.limitValue}/${rule.windowSeconds}s)，继续检查`
      );
    }
  }

  if (result.decision === 'ALLOW' && result.matchedRules.length > 0) {
    result.explanations.push('所有匹配规则均未触发限制，放行请求');
  }

  return result;
}

function simulateLimitCheck(rule, request) {
  const seed = hashCode(`${request.tenantId}-${request.path}-${request.regionCode}-${rule.id}`);
  const random = Math.abs(Math.sin(seed + (request.simulateIndex || 0))) * 10000;
  
  const thresholdPercent = rule.limitType === 'QPS' ? 
    (rule.limitValue < 50 ? 70 : rule.limitValue < 200 ? 60 : 50) : 
    50;
  
  return (random % 100) < thresholdPercent ? true : false;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function batchEvaluate(requests, activeRules, tenants, interfaceGroups, regions) {
  const results = requests.map((req, index) => 
    evaluateRequest({ ...req, simulateIndex: index }, activeRules, tenants, interfaceGroups, regions)
  );
  
  const stats = {
    total: results.length,
    allowed: results.filter(r => r.decision === 'ALLOW').length,
    rateLimited: results.filter(r => r.decision === 'RATE_LIMITED').length,
    rejected: results.filter(r => r.decision === 'REJECTED').length,
    vipExempted: results.filter(r => r.vipExempted).length,
    byRegion: {},
    byTenant: {},
  };

  results.forEach(r => {
    if (r.effectiveRegion) {
      stats.byRegion[r.effectiveRegion] = (stats.byRegion[r.effectiveRegion] || 0) + 1;
    }
    const tenantName = findTenantById(tenants, r.request.tenantId)?.name || r.request.tenantId;
    stats.byTenant[tenantName] = (stats.byTenant[tenantName] || 0) + 1;
  });

  return { results, stats };
}

function generateMockRequests(count = 50) {
  const paths = [
    '/api/order/create',
    '/api/order/pay',
    '/api/order/list',
    '/api/order/detail',
    '/api/product/list',
    '/api/user/info',
    '/api/user/login',
    '/api/order/refund',
  ];
  
  const tenantIds = ['t1', 't2', 't3', 't4', 't5'];
  const regionCodes = ['CN-EAST', 'CN-NORTH', 'CN-SOUTH', 'CN-WEST', 'DEFAULT'];
  const now = dayjs();
  
  const requests = [];
  for (let i = 0; i < count; i++) {
    requests.push({
      id: `req_${i + 1}`,
      tenantId: tenantIds[Math.floor(Math.random() * tenantIds.length)],
      regionCode: regionCodes[Math.floor(Math.random() * regionCodes.length)],
      path: paths[Math.floor(Math.random() * paths.length)],
      timestamp: now.subtract(Math.floor(Math.random() * 300), 'second').toISOString(),
      requestTime: `${Math.floor(Math.random() * 200) + 20}ms`,
      status: Math.random() > 0.1 ? '200' : (Math.random() > 0.5 ? '429' : '500'),
    });
  }
  return requests;
}

module.exports = {
  evaluateRequest,
  batchEvaluate,
  generateMockRequests,
  findTenantById,
  findInterfaceGroupByPath,
  getMatchingRules,
  isTenantVipExempt,
};
