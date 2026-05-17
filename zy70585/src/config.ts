import * as fs from 'fs';
import * as path from 'path';
import { ProxyConfig } from './types';

const DEFAULT_CONFIG: ProxyConfig = {
  trustedProxies: ['127.0.0.1', '::1'],
  trustDepth: 1,
  trustedHeaders: ['X-Forwarded-For', 'X-Forwarded-Proto', 'X-Forwarded-Host', 'X-Forwarded-Port']
};

export function loadConfig(configPath?: string): ProxyConfig {
  if (!configPath) {
    return { ...DEFAULT_CONFIG };
  }

  const absolutePath = path.resolve(configPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`配置文件不存在: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const userConfig = JSON.parse(content);

  return {
    trustedProxies: userConfig.trustedProxies || DEFAULT_CONFIG.trustedProxies,
    trustDepth: userConfig.trustDepth ?? DEFAULT_CONFIG.trustDepth,
    trustedHeaders: userConfig.trustedHeaders || DEFAULT_CONFIG.trustedHeaders
  };
}

export function validateConfig(config: ProxyConfig): string[] {
  const errors: string[] = [];

  if (!Array.isArray(config.trustedProxies)) {
    errors.push('trustedProxies 必须是数组');
  }

  if (typeof config.trustDepth !== 'number' || config.trustDepth < 0) {
    errors.push('trustDepth 必须是大于等于0的数字');
  }

  if (!Array.isArray(config.trustedHeaders)) {
    errors.push('trustedHeaders 必须是数组');
  }

  return errors;
}
