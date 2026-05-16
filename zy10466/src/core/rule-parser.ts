import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as dayjs from 'dayjs';
import { LifecycleRule, ObjectWithSource, MatchResult } from '../types';

export class RuleParser {
  private rules: LifecycleRule[] = [];

  loadRulesFromFile(filePath: string): LifecycleRule[] {
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf-8');
    
    if (ext === '.yaml' || ext === '.yml') {
      const data = yaml.load(content) as any;
      this.rules = data.Rules || data.rules || [];
    } else if (ext === '.json') {
      const data = JSON.parse(content);
      this.rules = data.Rules || data.rules || [];
    } else {
      throw new Error(`不支持的规则文件格式: ${ext}，请使用 YAML 或 JSON 格式`);
    }

    this.validateRules();
    return this.rules;
  }

  private validateRules(): void {
    for (const rule of this.rules) {
      if (!rule.id) {
        throw new Error('规则必须包含 id 字段');
      }
      if (!rule.status) {
        throw new Error(`规则 ${rule.id} 必须包含 status 字段`);
      }
      if (rule.status !== 'Enabled' && rule.status !== 'Disabled') {
        throw new Error(`规则 ${rule.id} 的 status 必须是 'Enabled' 或 'Disabled'`);
      }
    }
  }

  getRules(): LifecycleRule[] {
    return this.rules;
  }

  getEnabledRules(): LifecycleRule[] {
    return this.rules.filter(r => r.status === 'Enabled');
  }

  matchObject(object: ObjectWithSource, simulationDate: Date): MatchResult {
    const matchedRules: MatchResult['matchedRules'] = [];
    const enabledRules = this.getEnabledRules();

    for (const rule of enabledRules) {
      if (this.matchesFilter(object, rule)) {
        const expirationMatch = this.checkExpiration(object, rule, simulationDate);
        if (expirationMatch) {
          matchedRules.push(expirationMatch);
        }

        const noncurrentMatch = this.checkNoncurrentVersionExpiration(object, rule, simulationDate);
        if (noncurrentMatch) {
          matchedRules.push(noncurrentMatch);
        }
      }
    }

    const willBeDeleted = matchedRules.some(m => 
      m.actionType === 'expiration' || m.actionType === 'noncurrentVersionExpiration'
    );

    const earliestActionDate = matchedRules.length > 0
      ? matchedRules.reduce((earliest, m) => 
          m.scheduledDate < earliest ? m.scheduledDate : earliest, 
          matchedRules[0].scheduledDate
        )
      : undefined;

    return {
      object,
      matchedRules,
      willBeDeleted,
      earliestActionDate,
    };
  }

  private matchesFilter(object: ObjectWithSource, rule: LifecycleRule): boolean {
    if (!rule.filter) {
      return true;
    }

    if (rule.filter.prefix && !object.key.startsWith(rule.filter.prefix)) {
      return false;
    }

    if (rule.filter.tags && rule.filter.tags.length > 0) {
      for (const requiredTag of rule.filter.tags) {
        const hasTag = object.tags.some(
          t => t.key === requiredTag.key && t.value === requiredTag.value
        );
        if (!hasTag) {
          return false;
        }
      }
    }

    return true;
  }

  private checkExpiration(
    object: ObjectWithSource,
    rule: LifecycleRule,
    simulationDate: Date
  ): MatchResult['matchedRules'][0] | null {
    if (!rule.expiration) {
      return null;
    }

    let scheduledDate: Date;
    
    if (rule.expiration.date) {
      scheduledDate = dayjs(rule.expiration.date).toDate();
    } else if (rule.expiration.days !== undefined) {
      scheduledDate = dayjs(object.lastModified).add(rule.expiration.days, 'day').toDate();
    } else {
      return null;
    }

    const daysUntilAction = dayjs(simulationDate).diff(scheduledDate, 'day') * -1;

    return {
      rule,
      actionType: 'expiration',
      daysUntilAction,
      scheduledDate,
    };
  }

  private checkNoncurrentVersionExpiration(
    object: ObjectWithSource,
    rule: LifecycleRule,
    simulationDate: Date
  ): MatchResult['matchedRules'][0] | null {
    if (!rule.noncurrentVersionExpiration || object.isLatest) {
      return null;
    }

    const noncurrentDays = rule.noncurrentVersionExpiration.noncurrentDays;
    if (noncurrentDays === undefined) {
      return null;
    }

    const scheduledDate = dayjs(object.lastModified).add(noncurrentDays, 'day').toDate();
    const daysUntilAction = dayjs(simulationDate).diff(scheduledDate, 'day') * -1;

    return {
      rule,
      actionType: 'noncurrentVersionExpiration',
      daysUntilAction,
      scheduledDate,
    };
  }
}
