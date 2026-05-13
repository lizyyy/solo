import {
  KeySnapshot,
  AuditRules,
  KeyIssue,
  RedisKeyRecord,
  AcceptedIssuesStore,
  AuditReport,
  BusinessRiskSummary,
  TTLPolicy,
  RiskLevel,
  KeyExplanation,
  BusinessPrefix,
} from '../types';
import { toSeconds, formatTTL } from '../utils/ttl';
import { isIssueAccepted, getExpiredAcceptances } from '../loaders/loaders';

interface DedupResult {
  uniqueKeys: Map<string, RedisKeyRecord>;
  duplicateCount: number;
  keysByPrefix: Map<string, RedisKeyRecord[]>;
}

export function deduplicateKeys(snapshot: KeySnapshot): DedupResult {
  const uniqueKeys = new Map<string, RedisKeyRecord>();
  const keysByPrefix = new Map<string, RedisKeyRecord[]>();
  let duplicateCount = 0;

  for (const record of snapshot.keys) {
    if (uniqueKeys.has(record.key)) {
      duplicateCount++;
      const existing = uniqueKeys.get(record.key)!;
      if (record.lastSeenAt > existing.lastSeenAt) {
        uniqueKeys.set(record.key, record);
      }
    } else {
      uniqueKeys.set(record.key, record);
    }
  }

  return {
    uniqueKeys,
    duplicateCount,
    keysByPrefix,
  };
}

export function matchPrefix(key: string, rules: AuditRules): BusinessPrefix | null {
  const matched = rules.businessPrefixes
    .filter((p) => key.startsWith(p.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  
  return matched[0] || null;
}

export function getPolicyForPrefix(
  prefix: string,
  rules: AuditRules
): TTLPolicy | null {
  const binding = rules.policyBindings.find((b) => b.prefix === prefix);
  if (!binding) return null;
  return rules.ttlPolicies.find((p) => p.id === binding.policyId) || null;
}

function assessRiskLevel(
  issueType: KeyIssue['issueType'],
  rules: AuditRules,
  currentTTL: number | null
): RiskLevel {
  switch (issueType) {
    case 'no_ttl':
      return rules.globalSettings.treatNoTTLAs;
    case 'ttl_too_long':
      if (currentTTL === null) return 'critical';
      if (currentTTL > 30 * 24 * 3600) return 'critical';
      if (currentTTL > 7 * 24 * 3600) return 'high';
      return 'medium';
    case 'ttl_too_short':
      if (currentTTL !== null && currentTTL < 60) return 'high';
      return 'medium';
    case 'invalid_name':
      return 'medium';
    case 'policy_mismatch':
      return 'high';
    case 'inconsistent_policy':
      return 'medium';
    default:
      return 'low';
  }
}

function needsBusinessConfirmation(
  issueType: KeyIssue['issueType'],
  riskLevel: RiskLevel
): boolean {
  if (issueType === 'no_ttl') return true;
  if (riskLevel === 'critical' || riskLevel === 'high') return true;
  return false;
}

export function auditSingleKey(
  key: string,
  ttl: number | null,
  rules: AuditRules
): KeyIssue[] {
  const issues: KeyIssue[] = [];
  const prefixInfo = matchPrefix(key, rules);
  const businessPrefix = prefixInfo?.prefix || 'UNKNOWN';
  const isTemp = prefixInfo?.isTemporary || false;
  const policy = prefixInfo ? getPolicyForPrefix(prefixInfo.prefix, rules) : null;

  if (!prefixInfo) {
    issues.push({
      key,
      issueType: 'invalid_name',
      riskLevel: 'medium',
      currentTTL: ttl,
      businessPrefix,
      description: `Key "${key}" 未匹配到任何业务前缀`,
      needsBusinessConfirmation: false,
      isTemporary: false,
    });
  }

  if (ttl === null || ttl === -1) {
    if (!isTemp) {
      const level = assessRiskLevel('no_ttl', rules, ttl);
      issues.push({
        key,
        issueType: 'no_ttl',
        riskLevel: level,
        currentTTL: ttl,
        businessPrefix,
        description: `Key "${key}" 永不过期`,
        needsBusinessConfirmation: needsBusinessConfirmation('no_ttl', level),
        isTemporary: isTemp,
        policyId: policy?.id,
        suggestedTTL: policy ? toSeconds(policy.suggestedTTL, policy.unit) : undefined,
      });
    }
  } else {
    if (ttl > rules.globalSettings.maxAllowedTTL) {
      const level = assessRiskLevel('ttl_too_long', rules, ttl);
      issues.push({
        key,
        issueType: 'ttl_too_long',
        riskLevel: level,
        currentTTL: ttl,
        businessPrefix,
        description: `Key "${key}" 的 TTL (${formatTTL(ttl)}) 超过全局最大允许值`,
        needsBusinessConfirmation: needsBusinessConfirmation('ttl_too_long', level),
        isTemporary: isTemp,
        policyId: policy?.id,
        suggestedTTL: rules.globalSettings.maxAllowedTTL,
      });
    }

    if (ttl < rules.globalSettings.minWarnTTL) {
      const level = assessRiskLevel('ttl_too_short', rules, ttl);
      issues.push({
        key,
        issueType: 'ttl_too_short',
        riskLevel: level,
        currentTTL: ttl,
        businessPrefix,
        description: `Key "${key}" 的 TTL (${formatTTL(ttl)}) 可能过短，存在热点风险`,
        needsBusinessConfirmation: needsBusinessConfirmation('ttl_too_short', level),
        isTemporary: isTemp,
        policyId: policy?.id,
        suggestedTTL: rules.globalSettings.minWarnTTL,
      });
    }

    if (policy && prefixInfo) {
      const policyMin = toSeconds(policy.minTTL, policy.unit);
      const policyMax = toSeconds(policy.maxTTL, policy.unit);
      const suggested = toSeconds(policy.suggestedTTL, policy.unit);

      if (ttl < policyMin || ttl > policyMax) {
        const level = assessRiskLevel('policy_mismatch', rules, ttl);
        issues.push({
          key,
          issueType: 'policy_mismatch',
          riskLevel: level,
          currentTTL: ttl,
          expectedTTL: suggested,
          suggestedTTL: suggested,
          businessPrefix,
          description: `Key "${key}" 的 TTL 不符合业务策略 "${policy.name}" [${formatTTL(policyMin)}-${formatTTL(policyMax)}]`,
          needsBusinessConfirmation: needsBusinessConfirmation('policy_mismatch', level),
          isTemporary: isTemp,
          policyId: policy.id,
        });
      }
    }
  }

  return issues;
}

function detectInconsistentPolicies(
  uniqueKeys: Map<string, RedisKeyRecord>,
  rules: AuditRules
): KeyIssue[] {
  const issues: KeyIssue[] = [];
  const prefixTTLs = new Map<string, { min: number; max: number; keys: string[]; hasNoTTL: boolean }>();

  for (const [key, record] of uniqueKeys) {
    const prefixInfo = matchPrefix(key, rules);
    if (!prefixInfo) continue;
    
    const prefix = prefixInfo.prefix;
    const ttl = record.ttl;
    
    if (!prefixTTLs.has(prefix)) {
      prefixTTLs.set(prefix, {
        min: Infinity,
        max: -Infinity,
        keys: [],
        hasNoTTL: false,
      });
    }
    
    const entry = prefixTTLs.get(prefix)!;
    entry.keys.push(key);
    
    if (ttl === null || ttl === -1) {
      entry.hasNoTTL = true;
    } else {
      entry.min = Math.min(entry.min, ttl);
      entry.max = Math.max(entry.max, ttl);
    }
  }

  for (const [prefix, entry] of prefixTTLs) {
    if (entry.hasNoTTL && entry.keys.length > 1) {
      for (const key of entry.keys) {
        const record = uniqueKeys.get(key)!;
        if (record.ttl !== null && record.ttl !== -1) {
          continue;
        }
        issues.push({
          key,
          issueType: 'inconsistent_policy',
          riskLevel: 'medium',
          currentTTL: record.ttl,
          businessPrefix: prefix,
          description: `前缀 "${prefix}" 下存在混合策略：部分 key 永不过期，部分有 TTL`,
          needsBusinessConfirmation: true,
          policyId: undefined,
        });
      }
    }
    
    const range = entry.max - entry.min;
    if (entry.min !== Infinity && entry.max !== -Infinity && range > 3600 && entry.keys.length >= 3) {
      for (const key of entry.keys.slice(0, 3)) {
        const record = uniqueKeys.get(key)!;
        if (record.ttl === null || record.ttl === -1) continue;
        
        issues.push({
          key,
          issueType: 'inconsistent_policy',
          riskLevel: 'low',
          currentTTL: record.ttl,
          businessPrefix: prefix,
          description: `前缀 "${prefix}" 下 TTL 范围差异较大 (${formatTTL(entry.min)} ~ ${formatTTL(entry.max)})`,
          needsBusinessConfirmation: false,
          policyId: undefined,
        });
      }
    }
  }

  return issues;
}

export function performAudit(
  snapshot: KeySnapshot,
  rules: AuditRules,
  acceptedStore: AcceptedIssuesStore
): AuditReport {
  const now = Math.floor(Date.now() / 1000);
  const { uniqueKeys, duplicateCount } = deduplicateKeys(snapshot);
  
  const allIssues: KeyIssue[] = [];
  const acceptedCount = { value: 0 };

  for (const [key, record] of uniqueKeys) {
    const issues = auditSingleKey(key, record.ttl, rules);
    for (const issue of issues) {
      if (isIssueAccepted(issue.key, issue.issueType, acceptedStore, now)) {
        acceptedCount.value++;
        continue;
      }
      allIssues.push(issue);
    }
  }

  const inconsistentIssues = detectInconsistentPolicies(uniqueKeys, rules);
  for (const issue of inconsistentIssues) {
    if (!isIssueAccepted(issue.key, issue.issueType, acceptedStore, now)) {
      allIssues.push(issue);
    }
  }

  const expiredAcceptances = getExpiredAcceptances(acceptedStore, now);
  const businessSummaries = buildBusinessSummaries(allIssues, uniqueKeys, rules);

  const summary = {
    critical: allIssues.filter((i) => i.riskLevel === 'critical').length,
    high: allIssues.filter((i) => i.riskLevel === 'high').length,
    medium: allIssues.filter((i) => i.riskLevel === 'medium').length,
    low: allIssues.filter((i) => i.riskLevel === 'low').length,
    info: allIssues.filter((i) => i.riskLevel === 'info').length,
    accepted: acceptedCount.value,
  };

  return {
    generatedAt: now,
    totalKeysScanned: snapshot.keys.length,
    uniqueKeys: uniqueKeys.size,
    duplicateKeys: duplicateCount,
    isCompleteSnapshot: snapshot.isComplete,
    issues: allIssues,
    expiredAcceptances,
    businessSummaries,
    summary,
  };
}

function buildBusinessSummaries(
  issues: KeyIssue[],
  uniqueKeys: Map<string, RedisKeyRecord>,
  rules: AuditRules
): BusinessRiskSummary[] {
  const prefixMap = new Map<string, {
    keys: string[];
    issues: KeyIssue[];
  }>();

  for (const prefix of rules.businessPrefixes) {
    prefixMap.set(prefix.prefix, { keys: [], issues: [] });
  }

  for (const [key] of uniqueKeys) {
    const prefixInfo = matchPrefix(key, rules);
    const prefix = prefixInfo?.prefix || 'UNKNOWN';
    if (!prefixMap.has(prefix)) {
      prefixMap.set(prefix, { keys: [], issues: [] });
    }
    prefixMap.get(prefix)!.keys.push(key);
  }

  for (const issue of issues) {
    const prefix = issue.businessPrefix;
    if (!prefixMap.has(prefix)) {
      prefixMap.set(prefix, { keys: [], issues: [] });
    }
    prefixMap.get(prefix)!.issues.push(issue);
  }

  const summaries: BusinessRiskSummary[] = [];
  for (const [prefix, data] of prefixMap) {
    const prefixInfo = rules.businessPrefixes.find((p) => p.prefix === prefix);
    const totalKeys = data.keys.length;
    const issueCounts = {
      critical: data.issues.filter((i) => i.riskLevel === 'critical').length,
      high: data.issues.filter((i) => i.riskLevel === 'high').length,
      medium: data.issues.filter((i) => i.riskLevel === 'medium').length,
      low: data.issues.filter((i) => i.riskLevel === 'low').length,
      info: data.issues.filter((i) => i.riskLevel === 'info').length,
    };

    summaries.push({
      businessPrefix: prefix,
      description: prefixInfo?.description || '未知业务前缀',
      owner: prefixInfo?.owner,
      totalKeys,
      issues: issueCounts,
      exampleKeys: data.keys.slice(0, 5),
      suggestedAction: getSuggestedAction(issueCounts),
    });
  }

  return summaries.sort((a, b) => {
    const scoreA = a.issues.critical * 1000 + a.issues.high * 100 + a.issues.medium * 10;
    const scoreB = b.issues.critical * 1000 + b.issues.high * 100 + b.issues.medium * 10;
    return scoreB - scoreA;
  });
}

function getSuggestedAction(counts: BusinessRiskSummary['issues']): string {
  if (counts.critical > 0) {
    return '立即处理！存在严重风险，需要优先修复';
  }
  if (counts.high > 0) {
    return '本周内处理，存在高风险问题';
  }
  if (counts.medium > 0) {
    return '建议近期优化，存在中等风险';
  }
  if (counts.low > 0) {
    return '观察即可，风险较低';
  }
  return '无需操作，状态良好';
}

export function explainKey(
  key: string,
  snapshot: KeySnapshot,
  rules: AuditRules,
  acceptedStore: AcceptedIssuesStore
): KeyExplanation | null {
  const { uniqueKeys } = deduplicateKeys(snapshot);
  const record = uniqueKeys.get(key);
  
  if (!record) {
    return null;
  }

  const prefixInfo = matchPrefix(key, rules);
  const policy = prefixInfo ? getPolicyForPrefix(prefixInfo.prefix, rules) : null;
  const issues = auditSingleKey(key, record.ttl, rules);
  const now = Math.floor(Date.now() / 1000);
  
  const acceptanceStatus = acceptedStore.accepted.find(
    (a) => a.key === key
  );

  const activeIssues = issues.filter(
    (i) => !isIssueAccepted(i.key, i.issueType, acceptedStore, now)
  );

  return {
    key,
    matchedPrefix: prefixInfo?.prefix || 'UNKNOWN',
    currentTTL: record.ttl,
    assignedPolicy: policy || undefined,
    issues: activeIssues,
    isTemporary: prefixInfo?.isTemporary || false,
    acceptanceStatus: acceptanceStatus && acceptanceStatus.expiresAt > now ? acceptanceStatus : undefined,
  };
}
