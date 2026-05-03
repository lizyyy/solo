import * as path from 'path';
import { Rule, FileInfo, RuleCondition, RulesConfig } from '../types';

export class RuleMatcher {
  private readonly rules: Rule[];

  constructor(rulesConfig: RulesConfig) {
    this.rules = this.sortRulesByPriority(rulesConfig.rules);
  }

  findMatchingRule(fileInfo: FileInfo): { rule: Rule; matchDetails: string[] } | null {
    const matchDetails: string[] = [];
    
    for (const rule of this.rules) {
      const result = this.checkRuleMatch(rule, fileInfo);
      if (result.matches) {
        return {
          rule,
          matchDetails: result.details
        };
      }
    }

    return null;
  }

  findAllMatchingRules(fileInfo: FileInfo): { rule: Rule; matchDetails: string[] }[] {
    const matches: { rule: Rule; matchDetails: string[] }[] = [];

    for (const rule of this.rules) {
      const result = this.checkRuleMatch(rule, fileInfo);
      if (result.matches) {
        matches.push({
          rule,
          matchDetails: result.details
        });
      }
    }

    return matches;
  }

  private sortRulesByPriority(rules: Rule[]): Rule[] {
    return [...rules].sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA;
    });
  }

  private checkRuleMatch(rule: Rule, fileInfo: FileInfo): { matches: boolean; details: string[] } {
    const details: string[] = [];

    const result = this.evaluateCondition(rule.condition, fileInfo, details);

    return {
      matches: result,
      details
    };
  }

  private evaluateCondition(
    condition: RuleCondition,
    fileInfo: FileInfo,
    details: string[]
  ): boolean {
    const checks: { result: boolean; detail: string }[] = [];

    if (condition.extensions && condition.extensions.length > 0) {
      const match = this.matchExtension(fileInfo.extension, condition.extensions);
      checks.push({
        result: match,
        detail: match 
          ? `扩展名匹配: ${fileInfo.extension} ∈ [${condition.extensions.join(', ')}]`
          : `扩展名不匹配: ${fileInfo.extension} ∉ [${condition.extensions.join(', ')}]`
      });
    }

    if (condition.keywords && condition.keywords.length > 0) {
      const match = this.matchKeywords(fileInfo.name, condition.keywords);
      checks.push({
        result: match,
        detail: match
          ? `文件名包含关键词: "${fileInfo.name}" 包含 [${condition.keywords.join(', ')}]`
          : `文件名不包含关键词: "${fileInfo.name}" 不包含 [${condition.keywords.join(', ')}]`
      });
    }

    if (condition.minSize !== undefined) {
      const match = fileInfo.size >= condition.minSize;
      checks.push({
        result: match,
        detail: match
          ? `文件大小 >= ${this.formatSize(condition.minSize)}: ${this.formatSize(fileInfo.size)}`
          : `文件大小 < ${this.formatSize(condition.minSize)}: ${this.formatSize(fileInfo.size)}`
      });
    }

    if (condition.maxSize !== undefined) {
      const match = fileInfo.size <= condition.maxSize;
      checks.push({
        result: match,
        detail: match
          ? `文件大小 <= ${this.formatSize(condition.maxSize)}: ${this.formatSize(fileInfo.size)}`
          : `文件大小 > ${this.formatSize(condition.maxSize)}: ${this.formatSize(fileInfo.size)}`
      });
    }

    if (condition.modifiedAfter) {
      const afterDate = new Date(condition.modifiedAfter);
      const match = fileInfo.modifiedAt >= afterDate;
      checks.push({
        result: match,
        detail: match
          ? `修改时间 >= ${afterDate.toISOString()}: ${fileInfo.modifiedAt.toISOString()}`
          : `修改时间 < ${afterDate.toISOString()}: ${fileInfo.modifiedAt.toISOString()}`
      });
    }

    if (condition.modifiedBefore) {
      const beforeDate = new Date(condition.modifiedBefore);
      const match = fileInfo.modifiedAt <= beforeDate;
      checks.push({
        result: match,
        detail: match
          ? `修改时间 <= ${beforeDate.toISOString()}: ${fileInfo.modifiedAt.toISOString()}`
          : `修改时间 > ${beforeDate.toISOString()}: ${fileInfo.modifiedAt.toISOString()}`
      });
    }

    if (condition.createdAfter) {
      const afterDate = new Date(condition.createdAfter);
      const match = fileInfo.createdAt >= afterDate;
      checks.push({
        result: match,
        detail: match
          ? `创建时间 >= ${afterDate.toISOString()}: ${fileInfo.createdAt.toISOString()}`
          : `创建时间 < ${afterDate.toISOString()}: ${fileInfo.createdAt.toISOString()}`
      });
    }

    if (condition.createdBefore) {
      const beforeDate = new Date(condition.createdBefore);
      const match = fileInfo.createdAt <= beforeDate;
      checks.push({
        result: match,
        detail: match
          ? `创建时间 <= ${beforeDate.toISOString()}: ${fileInfo.createdAt.toISOString()}`
          : `创建时间 > ${beforeDate.toISOString()}: ${fileInfo.createdAt.toISOString()}`
      });
    }

    details.push(...checks.map(c => c.detail));

    return checks.length > 0 && checks.every(c => c.result);
  }

  private matchExtension(fileExtension: string, ruleExtensions: string[]): boolean {
    const normalizedFileExt = fileExtension.toLowerCase();
    return ruleExtensions.some(ext => {
      const normalizedRuleExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
      return normalizedFileExt === normalizedRuleExt;
    });
  }

  private matchKeywords(filename: string, keywords: string[]): boolean {
    const lowerFilename = filename.toLowerCase();
    return keywords.some(keyword => 
      lowerFilename.includes(keyword.toLowerCase())
    );
  }

  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
