import * as fs from 'fs';
import { parse } from 'yaml';
import { RulesConfig } from '../types';

const DEFAULT_RULES: RulesConfig = {
  maxTextLength: {
    button: 30,
    navigation: 20,
    title: 60
  },
  pluralRules: {
    requiredForms: ['one', 'other'],
    localeOverrides: {
      'zh-CN': ['other'],
      'zh-TW': ['other'],
      'ja': ['other'],
      'ko': ['other'],
      'ar': ['zero', 'one', 'two', 'few', 'many', 'other'],
      'ru': ['one', 'few', 'many', 'other'],
      'pl': ['one', 'few', 'many', 'other']
    }
  },
  deprecatedKeys: [],
  keyPatterns: {
    allowed: [],
    forbidden: []
  }
};

export class YamlParser {
  static parseRules(rulesPath: string): RulesConfig {
    try {
      const content = fs.readFileSync(rulesPath, 'utf-8');
      const parsed = parse(content) as Partial<RulesConfig>;
      
      return this.mergeWithDefaults(parsed);
    } catch (error) {
      console.warn(`Warning: Failed to parse rules file ${rulesPath}, using defaults.`);
      return DEFAULT_RULES;
    }
  }

  private static mergeWithDefaults(parsed: Partial<RulesConfig>): RulesConfig {
    return {
      maxTextLength: {
        ...DEFAULT_RULES.maxTextLength,
        ...parsed.maxTextLength
      },
      pluralRules: {
        requiredForms: parsed.pluralRules?.requiredForms || DEFAULT_RULES.pluralRules.requiredForms,
        localeOverrides: {
          ...DEFAULT_RULES.pluralRules.localeOverrides,
          ...parsed.pluralRules?.localeOverrides
        }
      },
      deprecatedKeys: parsed.deprecatedKeys || [],
      keyPatterns: {
        allowed: parsed.keyPatterns?.allowed || [],
        forbidden: parsed.keyPatterns?.forbidden || []
      }
    };
  }

  static getDefaultRules(): RulesConfig {
    return { ...DEFAULT_RULES };
  }
}
