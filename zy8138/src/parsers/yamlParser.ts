import yaml from 'js-yaml';
import type { ContinuityRule, ImportResult } from '../types';

export function parseContinuityRulesYaml(content: string): ImportResult<ContinuityRule[]> {
  const result: ImportResult<ContinuityRule[]> = {
    success: false,
    errors: [],
    warnings: [],
  };

  try {
    const parsed = yaml.load(content) as any;
    
    if (!parsed) {
      result.errors.push('YAML content is empty or invalid');
      return result;
    }

    const rules: ContinuityRule[] = [];

    if (Array.isArray(parsed.rules)) {
      for (let i = 0; i < parsed.rules.length; i++) {
        const ruleData = parsed.rules[i];
        
        if (!ruleData.id || !ruleData.name) {
          result.errors.push(`Rule at index ${i} is missing required fields: id or name`);
          continue;
        }

        const rule: ContinuityRule = {
          id: ruleData.id,
          ruleType: ruleData.ruleType || 'general',
          name: ruleData.name,
          description: ruleData.description || '',
          severity: validateSeverity(ruleData.severity, 'warning'),
          enabled: ruleData.enabled !== false,
        };

        rules.push(rule);
      }
    } else if (Array.isArray(parsed)) {
      for (let i = 0; i < parsed.length; i++) {
        const ruleData = parsed[i];
        
        if (!ruleData.id || !ruleData.name) {
          result.errors.push(`Rule at index ${i} is missing required fields: id or name`);
          continue;
        }

        const rule: ContinuityRule = {
          id: ruleData.id,
          ruleType: ruleData.ruleType || 'general',
          name: ruleData.name,
          description: ruleData.description || '',
          severity: validateSeverity(ruleData.severity, 'warning'),
          enabled: ruleData.enabled !== false,
        };

        rules.push(rule);
      }
    } else {
      result.errors.push('YAML must contain an array of rules or a "rules" array property');
      return result;
    }

    if (rules.length === 0 && result.errors.length === 0) {
      result.warnings.push('No continuity rules were parsed from the YAML file');
    }

    result.data = rules;
    result.success = result.errors.length === 0;
  } catch (error) {
    result.errors.push(`Failed to parse YAML: ${(error as Error).message}`);
  }

  return result;
}

function validateSeverity(severity: any, defaultSeverity: 'critical' | 'warning' | 'info'): 'critical' | 'warning' | 'info' {
  if (severity === 'critical' || severity === 'warning' || severity === 'info') {
    return severity;
  }
  return defaultSeverity;
}
