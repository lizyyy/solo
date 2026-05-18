const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const CLOCK_DRIFT_THRESHOLD_MS = 5000;
const RETRY_WINDOW_MS = 1000;

async function processLogs(inputPath, rulesPath) {
  console.log('📖 读取限流规则文件...');
  const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  
  console.log('📖 解析访问日志...');
  const logs = await parseLogs(inputPath);
  
  console.log(`✅ 共解析 ${logs.length} 条日志`);
  
  console.log('🔍 匹配限流规则...');
  const matchedLogs = matchRateLimitRules(logs, rules);
  
  console.log('📊 按租户和接口聚合归因...');
  const attribution = aggregateByTenantAndInterface(matchedLogs);
  
  console.log('⚠️  检测特殊情况...');
  const specialCases = detectSpecialCases(logs, matchedLogs, rules);
  
  return {
    summary: generateSummary(logs, matchedLogs, attribution, specialCases),
    attribution,
    specialCases,
    rawLogs: logs,
    matchedLogs,
    rules
  };
}

async function parseLogs(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  
  if (ext === '.jsonl') {
    return parseJsonl(inputPath);
  } else if (ext === '.csv') {
    return parseCsv(inputPath);
  } else {
    throw new Error(`不支持的文件格式: ${ext}，仅支持 .jsonl 和 .csv`);
  }
}

function parseJsonl(inputPath) {
  const logs = [];
  const lines = fs.readFileSync(inputPath, 'utf8').split('\n');
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        logs.push(JSON.parse(line));
      } catch (e) {
        console.warn(`⚠️  跳过无效 JSON 行: ${line.substring(0, 100)}...`);
      }
    }
  }
  
  return logs;
}

function parseCsv(inputPath) {
  return new Promise((resolve, reject) => {
    const logs = [];
    fs.createReadStream(inputPath)
      .pipe(csv())
      .on('data', (data) => logs.push(data))
      .on('end', () => resolve(logs))
      .on('error', reject);
  });
}

function matchRateLimitRules(logs, rules) {
  const matched = [];
  
  for (const log of logs) {
    const hitRules = [];
    
    for (const rule of rules.rateLimitRules) {
      if (isRuleMatched(log, rule)) {
        hitRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleVersion: rule.version,
          limitType: rule.limitType,
          threshold: rule.threshold,
          matchReason: getMatchReason(log, rule)
        });
      }
    }
    
    if (hitRules.length > 0) {
      matched.push({
        ...log,
        rateLimitHit: true,
        hitRules,
        primaryRule: hitRules[0]
      });
    }
  }
  
  return matched;
}

function isRuleMatched(log, rule) {
  if (!log.responseHeaders) return false;
  
  const rateLimitHeaders = [
    'x-ratelimit-remaining',
    'x-rate-limit-remaining',
    'x-ratelimit-hit',
    'x-rate-limit-hit'
  ];
  
  for (const header of rateLimitHeaders) {
    const value = log.responseHeaders[header];
    if (value !== undefined) {
      const numValue = parseInt(value, 10);
      if (numValue === 0 || value === 'true' || value === '1') {
        return true;
      }
    }
  }
  
  if (log.statusCode && (log.statusCode === 429 || log.statusCode === '429')) {
    return true;
  }
  
  if (log.body && typeof log.body === 'string' && 
      (log.body.includes('rate limit') || 
       log.body.includes('RateLimit') ||
       log.body.includes('限流'))) {
    return true;
  }
  
  return false;
}

function getMatchReason(log, rule) {
  const reasons = [];
  
  if (log.statusCode === 429 || log.statusCode === '429') {
    reasons.push('返回429状态码');
  }
  
  if (log.responseHeaders) {
    if (log.responseHeaders['x-ratelimit-remaining'] === '0' || 
        log.responseHeaders['x-rate-limit-remaining'] === '0') {
      reasons.push('限流剩余次数为0');
    }
    if (log.responseHeaders['x-ratelimit-hit'] === 'true' || 
        log.responseHeaders['x-rate-limit-hit'] === 'true') {
      reasons.push('命中限流标记');
    }
  }
  
  return reasons.length > 0 ? reasons.join('; ') : '规则匹配命中';
}

function aggregateByTenantAndInterface(matchedLogs) {
  const aggregation = new Map();
  
  for (const log of matchedLogs) {
    const tenantId = log.tenantId || log.tenant_id || 'unknown-tenant';
    const apiPath = log.apiPath || log.path || log.requestPath || 'unknown-api';
    const key = `${tenantId}|||${apiPath}`;
    
    if (!aggregation.has(key)) {
      aggregation.set(key, {
        tenantId,
        apiPath,
        totalHits: 0,
        hitRules: new Map(),
        timestamps: [],
        requestIds: []
      });
    }
    
    const agg = aggregation.get(key);
    agg.totalHits++;
    agg.timestamps.push(log.timestamp || log.requestTime);
    agg.requestIds.push(log.requestId || log.traceId);
    
    for (const rule of log.hitRules) {
      const ruleKey = rule.ruleId;
      if (!agg.hitRules.has(ruleKey)) {
        agg.hitRules.set(ruleKey, {
          ruleId: rule.ruleId,
          ruleName: rule.ruleName,
          ruleVersion: rule.ruleVersion,
          limitType: rule.limitType,
          hitCount: 0,
          reasons: new Set()
        });
      }
      
      const ruleAgg = agg.hitRules.get(ruleKey);
      ruleAgg.hitCount++;
      ruleAgg.reasons.add(rule.matchReason);
    }
  }
  
  return Array.from(aggregation.values()).map(item => ({
    ...item,
    hitRules: Array.from(item.hitRules.values()).map(r => ({
      ...r,
      reasons: Array.from(r.reasons)
    })),
    timeRange: getTimeRange(item.timestamps)
  })).sort((a, b) => b.totalHits - a.totalHits);
}

function getTimeRange(timestamps) {
  if (timestamps.length === 0) return null;
  
  const sorted = timestamps.map(t => new Date(t).getTime()).sort((a, b) => a - b);
  return {
    firstHit: new Date(sorted[0]).toISOString(),
    lastHit: new Date(sorted[sorted.length - 1]).toISOString(),
    durationMs: sorted[sorted.length - 1] - sorted[0]
  };
}

function detectSpecialCases(logs, matchedLogs, rules) {
  return {
    clockDrift: detectClockDrift(logs),
    gatewayRetries: detectGatewayRetries(logs),
    ruleVersionMismatch: detectRuleVersionMismatch(matchedLogs, rules)
  };
}

function detectClockDrift(logs) {
  const driftCases = [];
  
  for (let i = 1; i < logs.length; i++) {
    const prevTime = new Date(logs[i - 1].timestamp || logs[i - 1].requestTime).getTime();
    const currTime = new Date(logs[i].timestamp || logs[i].requestTime).getTime();
    
    if (currTime < prevTime - CLOCK_DRIFT_THRESHOLD_MS) {
      driftCases.push({
        index: i,
        requestId: logs[i].requestId || logs[i].traceId,
        previousTimestamp: logs[i - 1].timestamp || logs[i - 1].requestTime,
        currentTimestamp: logs[i].timestamp || logs[i].requestTime,
        driftMs: prevTime - currTime,
        severity: (prevTime - currTime) > 60000 ? 'high' : 'medium'
      });
    }
  }
  
  return {
    detected: driftCases.length > 0,
    count: driftCases.length,
    cases: driftCases
  };
}

function detectGatewayRetries(logs) {
  const requestGroups = new Map();
  
  for (const log of logs) {
    const requestId = log.requestId || log.traceId;
    if (!requestId) continue;
    
    if (!requestGroups.has(requestId)) {
      requestGroups.set(requestId, []);
    }
    requestGroups.get(requestId).push(log);
  }
  
  const retryCases = [];
  for (const [requestId, groupLogs] of requestGroups) {
    if (groupLogs.length > 1) {
      const times = groupLogs.map(l => new Date(l.timestamp || l.requestTime).getTime()).sort((a, b) => a - b);
      const intervals = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i - 1]);
      }
      
      const isRetry = intervals.every(interval => interval < RETRY_WINDOW_MS);
      
      if (isRetry) {
        retryCases.push({
          requestId,
          retryCount: groupLogs.length - 1,
          totalAttempts: groupLogs.length,
          intervalsMs: intervals,
          tenantId: groupLogs[0].tenantId || groupLogs[0].tenant_id,
          apiPath: groupLogs[0].apiPath || groupLogs[0].path,
          statusCodes: groupLogs.map(l => l.statusCode)
        });
      }
    }
  }
  
  return {
    detected: retryCases.length > 0,
    count: retryCases.length,
    cases: retryCases
  };
}

function detectRuleVersionMismatch(matchedLogs, rules) {
  const versionMap = new Map();
  const mismatchCases = [];
  
  for (const rule of rules.rateLimitRules) {
    versionMap.set(rule.id, rule.version);
  }
  
  const logRuleVersions = new Map();
  
  for (const log of matchedLogs) {
    for (const hitRule of log.hitRules) {
      const key = hitRule.ruleId;
      if (!logRuleVersions.has(key)) {
        logRuleVersions.set(key, new Set());
      }
      logRuleVersions.get(key).add(hitRule.ruleVersion);
    }
  }
  
  for (const [ruleId, versions] of logRuleVersions) {
    const expectedVersion = versionMap.get(ruleId);
    const versionArray = Array.from(versions);
    
    if (versionArray.length > 1 || (expectedVersion && !versions.has(expectedVersion))) {
      mismatchCases.push({
        ruleId,
        expectedVersion,
        actualVersions: versionArray,
        isMismatch: expectedVersion && !versions.has(expectedVersion),
        hasMultipleVersions: versionArray.length > 1
      });
    }
  }
  
  return {
    detected: mismatchCases.length > 0,
    count: mismatchCases.length,
    cases: mismatchCases
  };
}

function generateSummary(logs, matchedLogs, attribution, specialCases) {
  return {
    processingTime: new Date().toISOString(),
    totalLogs: logs.length,
    rateLimitHits: matchedLogs.length,
    hitRate: ((matchedLogs.length / logs.length) * 100).toFixed(2) + '%',
    affectedTenants: new Set(attribution.map(a => a.tenantId)).size,
    affectedApis: new Set(attribution.map(a => a.apiPath)).size,
    topHits: attribution.slice(0, 5).map(a => ({
      tenantId: a.tenantId,
      apiPath: a.apiPath,
      totalHits: a.totalHits
    })),
    specialCases: {
      clockDrift: {
        detected: specialCases.clockDrift.detected,
        count: specialCases.clockDrift.count
      },
      gatewayRetries: {
        detected: specialCases.gatewayRetries.detected,
        count: specialCases.gatewayRetries.count
      },
      ruleVersionMismatch: {
        detected: specialCases.ruleVersionMismatch.detected,
        count: specialCases.ruleVersionMismatch.count
      }
    }
  };
}

module.exports = {
  processLogs,
  parseLogs,
  matchRateLimitRules,
  aggregateByTenantAndInterface,
  detectSpecialCases
};
