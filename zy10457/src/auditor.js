const { DateTime } = require('luxon');

const RISK_LEVELS = {
  CRITICAL: { level: 0, name: '严重', color: 'red', description: '高风险，需立即处理' },
  HIGH: { level: 1, name: '高', color: 'orange', description: '即将过期，需关注' },
  MEDIUM: { level: 2, name: '中', color: 'yellow', description: '存在潜在问题' },
  LOW: { level: 3, name: '低', color: 'green', description: '正常状态' },
};

function auditSilences(silences, alerts, options) {
  const now = DateTime.now();
  const errors = [];
  const auditedSilences = [];
  const statistics = {
    total: silences.length,
    active: 0,
    expired: 0,
    pending: 0,
    byRiskLevel: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    byCreator: {},
    hitCount: 0,
    noHitCount: 0,
  };

  silences.forEach((silence, index) => {
    try {
      const auditResult = auditSingleSilence(silence, alerts, now, options);
      auditedSilences.push(auditResult);

      statistics[silence.status.state]++;
      statistics.byRiskLevel[auditResult.riskLevel]++;

      const creator = silence.createdBy || 'unknown';
      statistics.byCreator[creator] = (statistics.byCreator[creator] || 0) + 1;

      if (auditResult.hitStats.count > 0) {
        statistics.hitCount++;
      } else {
        statistics.noHitCount++;
      }

    } catch (e) {
      errors.push({
        type: 'AUDIT_ERROR',
        recordIndex: index,
        recordId: silence.id,
        message: e.message,
        stack: e.stack,
        source: silence.__source,
      });
    }
  });

  const topCreators = Object.entries(statistics.byCreator)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const highRiskSilences = auditedSilences
    .filter(s => s.riskLevel === 'CRITICAL' || s.riskLevel === 'HIGH')
    .sort((a, b) => RISK_LEVELS[a.riskLevel].level - RISK_LEVELS[b.riskLevel].level);

  const noHitSilences = auditedSilences.filter(s => s.hitStats.count === 0);
  const expiredSilences = auditedSilences.filter(s => s.status.state === 'expired');

  return {
    silences: auditedSilences,
    statistics: {
      ...statistics,
      topCreators,
    },
    summary: {
      totalSilences: silences.length,
      highRiskCount: highRiskSilences.length,
      activeCount: statistics.active,
      expiredCount: statistics.expired,
      noHitCount: noHitSilences.length,
      auditTime: now.toISO(),
      riskThreshold: options.riskThresholdDays,
      matchThreshold: options.matchThreshold,
    },
    highRiskSilences,
    noHitSilences,
    expiredSilences,
    errors,
  };
}

function auditSingleSilence(silence, alerts, now, options) {
  const startsAt = DateTime.fromISO(silence.startsAt);
  const endsAt = DateTime.fromISO(silence.endsAt);
  const createdAt = DateTime.fromISO(silence.createdAt);

  const timeAnalysis = analyzeTime(silence, startsAt, endsAt, createdAt, now, options);
  const labelAnalysis = analyzeLabels(silence);
  const hitStats = analyzeHits(silence, alerts);
  const riskLevel = calculateRiskLevel(silence, timeAnalysis, labelAnalysis, hitStats, options);

  const issues = [];
  if (timeAnalysis.isExpired) issues.push({ type: 'EXPIRED', message: '规则已过期' });
  if (timeAnalysis.daysRemaining !== null && timeAnalysis.daysRemaining <= 0) issues.push({ type: 'EXPIRED', message: '规则已过期' });
  if (timeAnalysis.daysRemaining !== null && timeAnalysis.daysRemaining <= options.riskThresholdDays && timeAnalysis.daysRemaining > 0) {
    issues.push({ type: 'EXPIRING_SOON', message: `将在 ${timeAnalysis.daysRemaining} 天后过期` });
  }
  if (labelAnalysis.isBroad) issues.push({ type: 'BROAD_MATCH', message: labelAnalysis.broadMatchReason });
  if (silence.status.state === 'active' && hitStats.count === 0) issues.push({ type: 'NO_HITS', message: '未命中任何告警' });
  if (!silence.comment || silence.comment.trim().length < 5) issues.push({ type: 'NO_COMMENT', message: '缺少说明或说明过短' });

  return {
    id: silence.id,
    status: silence.status,
    createdBy: silence.createdBy,
    comment: silence.comment,
    startsAt: silence.startsAt,
    endsAt: silence.endsAt,
    createdAt: silence.createdAt,
    matchers: silence.matchers,
    timeAnalysis,
    labelAnalysis,
    hitStats,
    riskLevel,
    riskLevelInfo: RISK_LEVELS[riskLevel],
    issues,
    source: silence.__source,
  };
}

function analyzeTime(silence, startsAt, endsAt, createdAt, now) {
  const duration = endsAt.diff(startsAt);
  const daysRemaining = silence.status.state === 'active' ? endsAt.diff(now, 'days').days : null;
  const ageDays = now.diff(createdAt, 'days').days;

  return {
    durationDays: duration.as('days'),
    daysRemaining: daysRemaining !== null ? Math.round(daysRemaining * 10) / 10 : null,
    ageDays: Math.round(ageDays * 10) / 10,
    isExpired: silence.status.state === 'expired',
    isLongRunning: duration.as('days') > 30,
  };
}

function analyzeLabels(silence) {
  const matchers = silence.matchers;
  const labelNames = matchers.map(m => m.name);
  const hasAlertName = labelNames.includes('alertname');
  const hasSeverity = labelNames.includes('severity');
  
  const regexMatchers = matchers.filter(m => m.isRegex);
  const negativeMatchers = matchers.filter(m => !m.isEqual);
  
  let isBroad = false;
  let broadMatchReason = '';

  if (regexMatchers.length > 0) {
    const hasBroadRegex = regexMatchers.some(m => 
      m.value === '.*' || m.value === '.+' || m.value === '.*?'
    );
    if (hasBroadRegex) {
      isBroad = true;
      broadMatchReason = '包含通配符正则匹配，可能覆盖过多告警';
    }
  }

  if (!hasAlertName && !hasSeverity && matchers.length <= 2) {
    isBroad = true;
    broadMatchReason = '缺少关键标签(alertname/severity)，匹配范围过宽';
  }

  const allMatchers = matchers.map(m => ({
    name: m.name,
    value: m.value,
    isRegex: m.isRegex,
    isEqual: m.isEqual,
  }));

  return {
    matcherCount: matchers.length,
    labelNames,
    hasAlertName,
    hasSeverity,
    regexMatcherCount: regexMatchers.length,
    negativeMatcherCount: negativeMatchers.length,
    isBroad,
    broadMatchReason,
    allMatchers,
  };
}

function analyzeHits(silence, alerts) {
  if (!alerts || alerts.length === 0) {
    return { count: 0, matchedAlerts: [], bySeverity: {} };
  }

  const matchedAlerts = [];
  const bySeverity = {};

  alerts.forEach(alert => {
    if (matchesSilence(silence, alert)) {
      matchedAlerts.push(alert);
      const severity = alert.labels?.severity || 'unknown';
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
    }
  });

  return {
    count: matchedAlerts.length,
    matchedAlerts: matchedAlerts.slice(0, 50),
    bySeverity,
    hasCriticalHits: bySeverity.critical > 0 || bySeverity.page > 0,
  };
}

function matchesSilence(silence, alert) {
  const alertLabels = alert.labels || {};

  for (const matcher of silence.matchers) {
    const labelValue = alertLabels[matcher.name] || '';
    const matches = matcherValueMatches(matcher, labelValue);
    
    if (matcher.isEqual && !matches) return false;
    if (!matcher.isEqual && matches) return false;
  }

  return true;
}

function matcherValueMatches(matcher, value) {
  if (!matcher.isRegex) {
    return value === matcher.value;
  }
  
  try {
    const regex = new RegExp(matcher.value);
    return regex.test(value);
  } catch {
    return value === matcher.value;
  }
}

function calculateRiskLevel(silence, timeAnalysis, labelAnalysis, hitStats, options) {
  let score = 0;

  if (timeAnalysis.isExpired) {
    score += 50;
  } else if (timeAnalysis.daysRemaining !== null) {
    if (timeAnalysis.daysRemaining <= 0) score += 50;
    else if (timeAnalysis.daysRemaining <= 3) score += 30;
    else if (timeAnalysis.daysRemaining <= options.riskThresholdDays) score += 20;
  }

  if (labelAnalysis.isBroad) {
    score += 25;
  }

  if (hitStats.count === 0 && silence.status.state === 'active') {
    score += 15;
  }

  if (hitStats.hasCriticalHits) {
    score += 20;
  }

  if (!silence.comment || silence.comment.trim().length < 5) {
    score += 10;
  }

  if (timeAnalysis.isLongRunning) {
    score += 10;
  }

  if (score >= 50) return 'CRITICAL';
  if (score >= 30) return 'HIGH';
  if (score >= 15) return 'MEDIUM';
  return 'LOW';
}

module.exports = {
  auditSilences,
  RISK_LEVELS,
};
