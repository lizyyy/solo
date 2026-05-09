import fs from 'fs-extra';
import { EnvConfig, DiffItem } from './types';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export async function parseConfigFile(filePath: string): Promise<EnvConfig> {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const content = await fs.readFile(filePath, 'utf-8');

  switch (ext) {
    case 'json':
      return JSON.parse(content);
    case 'env':
      return parseDotEnv(content);
    case 'yaml':
    case 'yml':
      return parseYaml(content);
    default:
      try {
        return JSON.parse(content);
      } catch {
        try {
          return parseDotEnv(content);
        } catch {
          throw new Error(`无法解析文件格式: ${ext || '未知'}`);
        }
      }
  }
}

function parseDotEnv(content: string): EnvConfig {
  const result: EnvConfig = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();

      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (value === 'true') result[key] = true;
      else if (value === 'false') result[key] = false;
      else if (!isNaN(Number(value)) && value !== '') result[key] = Number(value);
      else result[key] = value;
    }
  }

  return result;
}

function parseYaml(content: string): EnvConfig {
  const result: EnvConfig = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();

      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (value === 'true') result[key] = true;
      else if (value === 'false') result[key] = false;
      else if (!isNaN(Number(value)) && value !== '') result[key] = Number(value);
      else result[key] = value || undefined;
    }
  }

  return result;
}

export function compareConfigs(
  configA: EnvConfig,
  configB: EnvConfig,
  envA: string,
  envB: string
): DiffItem[] {
  const items: DiffItem[] = [];
  const allKeys = new Set([...Object.keys(configA), ...Object.keys(configB)]);

  for (const key of allKeys) {
    const valA = configA[key];
    const valB = configB[key];

    if (valA === undefined && valB !== undefined) {
      items.push({
        key,
        type: 'added',
        envB: valB,
        environmentA: envA,
        environmentB: envB
      });
    } else if (valA !== undefined && valB === undefined) {
      items.push({
        key,
        type: 'removed',
        envA: valA,
        environmentA: envA,
        environmentB: envB
      });
    } else if (String(valA) !== String(valB)) {
      items.push({
        key,
        type: 'modified',
        envA: valA,
        envB: valB,
        environmentA: envA,
        environmentB: envB
      });
    } else {
      items.push({
        key,
        type: 'unchanged',
        envA: valA,
        envB: valB,
        environmentA: envA,
        environmentB: envB
      });
    }
  }

  return items.sort((a, b) => {
    const order: Record<string, number> = { modified: 0, added: 1, removed: 2, unchanged: 3 };
    return order[a.type] - order[b.type] || a.key.localeCompare(b.key);
  });
}

export function computeChanges(
  oldConfig: EnvConfig,
  newConfig: EnvConfig
): Array<{ action: 'add' | 'update' | 'delete'; key: string; oldValue?: string; newValue?: string }> {
  const changes: Array<{
    action: 'add' | 'update' | 'delete';
    key: string;
    oldValue?: string;
    newValue?: string;
  }> = [];

  for (const [key, value] of Object.entries(newConfig)) {
    const oldValue = oldConfig[key];
    if (oldValue === undefined) {
      changes.push({ action: 'add', key, newValue: String(value) });
    } else if (String(oldValue) !== String(value)) {
      changes.push({
        action: 'update',
        key,
        oldValue: String(oldValue),
        newValue: String(value)
      });
    }
  }

  for (const key of Object.keys(oldConfig)) {
    if (newConfig[key] === undefined) {
      changes.push({ action: 'delete', key, oldValue: String(oldConfig[key]) });
    }
  }

  return changes;
}

export function formatValue(value?: string | number | boolean): string {
  if (value === undefined) return '(未设置)';
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 50) + '...';
  }
  return String(value);
}
