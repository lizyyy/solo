import * as fs from 'fs';
import * as path from 'path';
import { ExceptionRule } from './types';
import { normalizeFilePath, isExpired, matchesGlobPattern } from './utils';

export class ExceptionLoader {
  private rules: ExceptionRule[] = [];
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<ExceptionRule[]> {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    const content = await fs.promises.readFile(this.filePath, 'utf-8');
    
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        this.rules = data.map(this.validateRule.bind(this));
      } else if (data.exceptions && Array.isArray(data.exceptions)) {
        this.rules = data.exceptions.map(this.validateRule.bind(this));
      }
    } catch (error) {
      throw new Error(`Failed to parse exceptions file: ${(error as Error).message}`);
    }

    return this.rules;
  }

  private validateRule(rule: Partial<ExceptionRule>): ExceptionRule {
    if (!rule.path) {
      throw new Error('Exception rule must have a "path" field');
    }
    if (!rule.reason) {
      throw new Error(`Exception rule for path "${rule.path}" must have a "reason" field`);
    }
    if (!rule.createdAt) {
      throw new Error(`Exception rule for path "${rule.path}" must have a "createdAt" field`);
    }
    if (!rule.createdBy) {
      throw new Error(`Exception rule for path "${rule.path}" must have a "createdBy" field`);
    }

    return {
      path: rule.path,
      reason: rule.reason,
      expiresAt: rule.expiresAt,
      createdAt: rule.createdAt,
      createdBy: rule.createdBy,
    };
  }

  getMatchingRule(filePath: string): ExceptionRule | undefined {
    const normalizedPath = normalizeFilePath(filePath);
    
    for (const rule of this.rules) {
      if (matchesGlobPattern(normalizedPath, rule.path)) {
        return rule;
      }
    }

    return undefined;
  }

  getExpiredRules(): ExceptionRule[] {
    return this.rules.filter(rule => rule.expiresAt && isExpired(rule.expiresAt));
  }

  getActiveRules(): ExceptionRule[] {
    return this.rules.filter(rule => !rule.expiresAt || !isExpired(rule.expiresAt));
  }

  getAllRules(): ExceptionRule[] {
    return this.rules;
  }

  isPathExcluded(filePath: string): boolean {
    const rule = this.getMatchingRule(filePath);
    if (!rule) return false;
    if (rule.expiresAt && isExpired(rule.expiresAt)) return false;
    return true;
  }
}

export async function loadExceptions(filePath: string): Promise<ExceptionLoader> {
  const loader = new ExceptionLoader(filePath);
  await loader.load();
  return loader;
}
