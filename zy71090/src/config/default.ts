import { TTLTierConfig, EnvironmentConfig } from '../types';

export const DEFAULT_TTL_TIERS: TTLTierConfig[] = [
  {
    tier: 'CRITICAL',
    min: 0,
    max: 60,
    description: '关键服务 - 小于1分钟',
    color: 'red'
  },
  {
    tier: 'HIGH',
    min: 61,
    max: 300,
    description: '高优先级 - 1-5分钟',
    color: 'orange'
  },
  {
    tier: 'MEDIUM',
    min: 301,
    max: 1800,
    description: '中等 - 5-30分钟',
    color: 'yellow'
  },
  {
    tier: 'LOW',
    min: 1801,
    max: 86400,
    description: '低优先级 - 30分钟-1天',
    color: 'green'
  },
  {
    tier: 'LEGACY',
    min: 86401,
    max: Infinity,
    description: '遗留配置 - 大于1天',
    color: 'magenta'
  }
];

export const DEFAULT_ENVIRONMENTS: EnvironmentConfig[] = [
  {
    name: 'production',
    patterns: ['prod', 'production', 'www', 'api'],
    color: 'red'
  },
  {
    name: 'staging',
    patterns: ['staging', 'stage', 'stg', 'preprod'],
    color: 'yellow'
  },
  {
    name: 'testing',
    patterns: ['test', 'testing', 'tst', 'qa'],
    color: 'blue'
  },
  {
    name: 'development',
    patterns: ['dev', 'development', 'local'],
    color: 'green'
  },
  {
    name: 'internal',
    patterns: ['internal', 'intranet', 'corp'],
    color: 'cyan'
  },
  {
    name: 'monitoring',
    patterns: ['monitor', 'metrics', 'logs', 'alert'],
    color: 'magenta'
  }
];

export const DEFAULT_MIGRATION_RECOMMENDED_TTL = 300;

export const DEFAULT_OUTPUT_DIR = './reports';

export const VALID_RECORD_TYPES = [
  'A', 'AAAA', 'CNAME', 'MX', 'NS', 'PTR', 'SOA', 'SRV', 'TXT',
  'SPF', 'DKIM', 'DMARC', 'CAA', 'NAPTR', 'SSHFP', 'TLSA'
];

export const MAX_CNAME_CHAIN_DEPTH = 10;

export const DEFAULT_MIN_TTL_WARN = 300;
export const DEFAULT_MAX_TTL_WARN = 3600;
