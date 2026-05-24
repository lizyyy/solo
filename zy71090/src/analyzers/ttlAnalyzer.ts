import { readFileSync } from 'fs';
import { ZoneData, TTLAnalysis, TTLTierConfig, CLIOptions } from '../types';
import { DEFAULT_TTL_TIERS, DEFAULT_MIGRATION_RECOMMENDED_TTL } from '../config/default';

export function analyzeTTL(zoneData: ZoneData, options: CLIOptions): TTLAnalysis[] {
  const tiers = loadTTLConfig(options.ttlConfig);
  const migrationWindowTTL = parseMigrationWindow(options.migrationWindow);
  
  return zoneData.records.map(record => {
    const tierConfig = getTierForTTL(record.ttl, tiers);
    const needsAdjustment = checkNeedsAdjustment(record, tierConfig, options, migrationWindowTTL);
    const recommendedTTL = calculateRecommendedTTL(record, tierConfig, migrationWindowTTL, options);
    const reason = generateReason(record, tierConfig, needsAdjustment, options);
    
    return {
      record,
      tier: tierConfig.tier,
      tierInfo: tierConfig,
      needsAdjustment,
      recommendedTTL,
      reason
    };
  });
}

function loadTTLConfig(configPath?: string): TTLTierConfig[] {
  if (!configPath) {
    return DEFAULT_TTL_TIERS;
  }
  
  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    if (Array.isArray(config)) {
      return config.sort((a: TTLTierConfig, b: TTLTierConfig) => a.min - b.min);
    }
    return DEFAULT_TTL_TIERS;
  } catch {
    return DEFAULT_TTL_TIERS;
  }
}

function parseMigrationWindow(window?: string): number | null {
  if (!window) return null;
  
  const hours = parseFloat(window);
  if (isNaN(hours) || hours <= 0) return null;
  
  return Math.floor(hours * 3600 / 2);
}

function getTierForTTL(ttl: number, tiers: TTLTierConfig[]): TTLTierConfig {
  for (const tier of tiers) {
    if (ttl >= tier.min && ttl <= tier.max) {
      return tier;
    }
  }
  return tiers[tiers.length - 1];
}

function checkNeedsAdjustment(
  record: { ttl: number; type: string },
  tierConfig: TTLTierConfig,
  options: CLIOptions,
  migrationWindowTTL: number | null
): boolean {
  if (migrationWindowTTL && record.ttl > migrationWindowTTL) {
    return true;
  }
  
  if (record.ttl > options.maxTTLWarn) {
    return true;
  }
  
  if (record.ttl < options.minTTLWarn && record.type !== 'A' && record.type !== 'AAAA') {
    return true;
  }
  
  if (tierConfig.tier === 'LEGACY') {
    return true;
  }
  
  if (record.type === 'CNAME' && record.ttl > 1800) {
    return true;
  }
  
  if (record.type === 'MX' && record.ttl > 3600) {
    return true;
  }
  
  return false;
}

function calculateRecommendedTTL(
  record: { ttl: number; type: string },
  tierConfig: TTLTierConfig,
  migrationWindowTTL: number | null,
  options: CLIOptions
): number {
  if (migrationWindowTTL) {
    return Math.min(migrationWindowTTL, DEFAULT_MIGRATION_RECOMMENDED_TTL);
  }
  
  const typeRecommended: Record<string, number> = {
    'A': 300,
    'AAAA': 300,
    'CNAME': 300,
    'MX': 1800,
    'NS': 86400,
    'TXT': 3600,
    'SRV': 300,
    'PTR': 3600
  };
  
  const recommended = typeRecommended[record.type] || options.maxTTLWarn;
  return Math.min(recommended, 3600);
}

function generateReason(
  record: { ttl: number; type: string; name: string },
  tierConfig: TTLTierConfig,
  needsAdjustment: boolean,
  options: CLIOptions
): string {
  if (!needsAdjustment) {
    return 'TTL 配置合理';
  }
  
  const reasons: string[] = [];
  
  if (tierConfig.tier === 'LEGACY') {
    reasons.push('TTL 超过 1 天，属于遗留配置');
  }
  
  if (record.ttl > options.maxTTLWarn) {
    reasons.push(`TTL 超过最大警告阈值 (${options.maxTTLWarn}s)`);
  }
  
  if (record.ttl < options.minTTLWarn && record.type !== 'A' && record.type !== 'AAAA') {
    reasons.push(`TTL 低于最小警告阈值 (${options.minTTLWarn}s)`);
  }
  
  if (record.type === 'CNAME' && record.ttl > 1800) {
    reasons.push('CNAME 记录建议 TTL <= 30 分钟');
  }
  
  if (record.type === 'MX' && record.ttl > 3600) {
    reasons.push('MX 记录建议 TTL <= 1 小时');
  }
  
  return reasons.join('; ') || '建议调整 TTL 以适应迁移';
}

export function getTTLDistribution(analysis: TTLAnalysis[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  
  for (const item of analysis) {
    distribution[item.tier] = (distribution[item.tier] || 0) + 1;
  }
  
  return distribution;
}

export function getRecordsNeedingAdjustment(analysis: TTLAnalysis[]): TTLAnalysis[] {
  return analysis.filter(a => a.needsAdjustment);
}

export function getRecordsByTier(analysis: TTLAnalysis[], tier: string): TTLAnalysis[] {
  return analysis.filter(a => a.tier === tier);
}
