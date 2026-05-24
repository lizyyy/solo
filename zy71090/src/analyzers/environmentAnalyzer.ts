import { readFileSync } from 'fs';
import { ZoneData, EnvironmentRecord, EnvironmentConfig } from '../types';
import { DEFAULT_ENVIRONMENTS } from '../config/default';

export function analyzeEnvironments(
  zoneData: ZoneData,
  targetEnvironments: string[],
  configPath?: string
): EnvironmentRecord[] {
  const envConfigs = loadEnvConfig(configPath);
  const filteredConfigs = envConfigs.filter(e => targetEnvironments.includes(e.name));
  
  return zoneData.records.map(record => {
    const environments = detectEnvironments(record.name, filteredConfigs);
    const isWildcard = record.name.startsWith('*');
    const hasAlias = checkForAlias(record, zoneData);
    
    return {
      record,
      environments,
      isWildcard,
      hasAlias
    };
  });
}

function loadEnvConfig(configPath?: string): EnvironmentConfig[] {
  if (!configPath) {
    return DEFAULT_ENVIRONMENTS;
  }
  
  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    if (Array.isArray(config)) {
      return config;
    }
    return DEFAULT_ENVIRONMENTS;
  } catch {
    return DEFAULT_ENVIRONMENTS;
  }
}

function detectEnvironments(domain: string, envConfigs: EnvironmentConfig[]): string[] {
  const environments: string[] = [];
  const domainLower = domain.toLowerCase();
  
  for (const env of envConfigs) {
    for (const pattern of env.patterns) {
      if (matchesPattern(domainLower, pattern)) {
        if (!environments.includes(env.name)) {
          environments.push(env.name);
        }
        break;
      }
    }
  }
  
  if (environments.length === 0) {
    environments.push('unknown');
  }
  
  return environments;
}

function matchesPattern(domain: string, pattern: string): boolean {
  if (!pattern) return true;
  
  const patternLower = pattern.toLowerCase();
  
  if (domain === patternLower) {
    return true;
  }
  
  if (domain.startsWith(patternLower + '.') || 
      domain.includes('.' + patternLower + '.') ||
      domain.endsWith('.' + patternLower)) {
    return true;
  }
  
  if (domain.includes('-' + patternLower + '-') ||
      domain.startsWith(patternLower + '-') ||
      domain.endsWith('-' + patternLower)) {
    return true;
  }
  
  return false;
}

function checkForAlias(record: { name: string; type: string }, zoneData: ZoneData): boolean {
  if (record.type !== 'CNAME') {
    return false;
  }
  
  const cnameTargets = zoneData.records
    .filter(r => r.type === 'CNAME')
    .map(r => r.value);
  
  return cnameTargets.includes(record.name);
}

export function getRecordsByEnvironment(
  analysis: EnvironmentRecord[],
  environment: string
): EnvironmentRecord[] {
  return analysis.filter(a => a.environments.includes(environment));
}

export function getWildcardRecords(analysis: EnvironmentRecord[]): EnvironmentRecord[] {
  return analysis.filter(a => a.isWildcard);
}

export function getAliasRecords(analysis: EnvironmentRecord[]): EnvironmentRecord[] {
  return analysis.filter(a => a.hasAlias);
}

export function getEnvironmentCounts(analysis: EnvironmentRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  for (const item of analysis) {
    for (const env of item.environments) {
      counts[env] = (counts[env] || 0) + 1;
    }
  }
  
  return counts;
}

export function expandWildcardRecord(
  wildcardRecord: EnvironmentRecord,
  allRecords: EnvironmentRecord[]
): string[] {
  if (!wildcardRecord.isWildcard) {
    return [];
  }
  
  const wildcardPattern = wildcardRecord.record.name.replace('*', '');
  const matchingRecords: string[] = [];
  
  for (const record of allRecords) {
    if (record.isWildcard) continue;
    if (record.record.name.includes(wildcardPattern)) {
      matchingRecords.push(record.record.name);
    }
  }
  
  return matchingRecords;
}
