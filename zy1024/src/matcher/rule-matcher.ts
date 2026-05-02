import { minimatch } from 'minimatch';
import { GitChange, Rule, ModuleConfig, MatchedRule, RiskLevel } from '../types';

export interface ModuleMatchResult {
  module: ModuleConfig;
  matchedPath: string;
}

export class RuleMatcher {
  private modules: ModuleConfig[];
  private rules: Rule[];
  private defaultRiskLevel: RiskLevel;

  constructor(modules: ModuleConfig[], rules: Rule[], defaultRiskLevel: RiskLevel = 'medium') {
    this.modules = modules;
    this.rules = rules;
    this.defaultRiskLevel = defaultRiskLevel;
  }

  matchModule(change: GitChange): ModuleMatchResult | null {
    for (const module of this.modules) {
      for (const pathPattern of module.paths) {
        if (this.matchPath(change.filePath, pathPattern)) {
          return {
            module,
            matchedPath: pathPattern
          };
        }
        
        if (change.oldFilePath && this.matchPath(change.oldFilePath, pathPattern)) {
          return {
            module,
            matchedPath: pathPattern
          };
        }
      }
    }
    return null;
  }

  matchRules(change: GitChange, currentModule: ModuleConfig | null): MatchedRule[] {
    const matchedRules: MatchedRule[] = [];
    
    for (const rule of this.rules) {
      const result = this.matchSingleRule(change, rule, currentModule);
      if (result) {
        matchedRules.push(result);
      }
    }
    
    return matchedRules;
  }

  private matchSingleRule(change: GitChange, rule: Rule, currentModule: ModuleConfig | null): MatchedRule | null {
    const matchedBy: MatchedRule['matchedBy'] = {};
    let matchedKeyword: string | undefined;

    if (rule.keywords && rule.keywords.length > 0 && change.diffContent) {
      const diffLower = change.diffContent.toLowerCase();
      for (const keyword of rule.keywords) {
        if (diffLower.includes(keyword.toLowerCase())) {
          matchedBy.keyword = true;
          matchedKeyword = keyword;
          break;
        }
      }
      
      const fileNameLower = change.filePath.toLowerCase();
      if (!matchedBy.keyword) {
        for (const keyword of rule.keywords) {
          if (fileNameLower.includes(keyword.toLowerCase())) {
            matchedBy.keyword = true;
            matchedKeyword = keyword;
            break;
          }
        }
      }
    }

    if (rule.paths && rule.paths.length > 0) {
      for (const pathPattern of rule.paths) {
        if (this.matchPath(change.filePath, pathPattern)) {
          matchedBy.path = true;
          break;
        }
        if (change.oldFilePath && this.matchPath(change.oldFilePath, pathPattern)) {
          matchedBy.path = true;
          break;
        }
      }
    }

    if (rule.fileTypes && rule.fileTypes.length > 0) {
      for (const fileType of rule.fileTypes) {
        if (this.matchFileType(change.filePath, fileType)) {
          matchedBy.fileType = true;
          break;
        }
      }
    }

    if (rule.modules && rule.modules.length > 0 && currentModule) {
      if (rule.modules.includes(currentModule.name)) {
        matchedBy.module = true;
      }
    }

    const hasPositiveMatches = Object.values(matchedBy).some(v => v === true);
    
    if (!hasPositiveMatches) {
      return null;
    }

    return {
      rule,
      matchedBy,
      matchedKeyword
    };
  }

  private matchPath(filePath: string, pattern: string): boolean {
    let normalizedFilePath = filePath;
    let normalizedPattern = pattern;

    if (normalizedFilePath.startsWith('./')) {
      normalizedFilePath = normalizedFilePath.slice(2);
    }
    if (normalizedPattern.startsWith('./')) {
      normalizedPattern = normalizedPattern.slice(2);
    }

    return minimatch(normalizedFilePath, normalizedPattern, {
      dot: true,
      matchBase: true
    });
  }

  private matchFileType(filePath: string, fileType: string): boolean {
    let extension = filePath.substring(filePath.lastIndexOf('.'));
    if (!extension.startsWith('.')) {
      extension = '.' + extension;
    }

    if (!fileType.startsWith('.')) {
      return filePath.toLowerCase().endsWith('.' + fileType.toLowerCase());
    }
    
    return extension.toLowerCase() === fileType.toLowerCase();
  }

  calculateRiskLevel(
    change: GitChange,
    matchedRules: MatchedRule[],
    moduleMatch: ModuleMatchResult | null
  ): RiskLevel {
    if (matchedRules.length === 0) {
      if (moduleMatch && moduleMatch.module.riskLevel) {
        return moduleMatch.module.riskLevel;
      }
      return this.defaultRiskLevel;
    }

    const riskOrder: Record<RiskLevel, number> = {
      'critical': 4,
      'high': 3,
      'medium': 2,
      'low': 1
    };

    let maxRisk: RiskLevel = 'low';
    let maxScore = 0;

    for (const matchedRule of matchedRules) {
      const ruleRisk = matchedRule.rule.riskLevel;
      const score = riskOrder[ruleRisk];
      if (score > maxScore) {
        maxScore = score;
        maxRisk = ruleRisk;
      }
    }

    return maxRisk;
  }

  collectCheckCommands(
    matchedRules: MatchedRule[],
    moduleMatch: ModuleMatchResult | null,
    globalCheckCommands: string[]
  ): string[] {
    const commands = new Set<string>();

    for (const matchedRule of matchedRules) {
      for (const cmd of matchedRule.rule.checkCommands) {
        if (cmd.trim()) {
          commands.add(cmd.trim());
        }
      }
    }

    if (moduleMatch) {
      for (const cmd of moduleMatch.module.defaultCheckCommands) {
        if (cmd.trim()) {
          commands.add(cmd.trim());
        }
      }
    }

    for (const cmd of globalCheckCommands) {
      if (cmd.trim()) {
        commands.add(cmd.trim());
      }
    }

    return Array.from(commands);
  }

  collectConfirmations(matchedRules: MatchedRule[]): string[] {
    const confirmations = new Set<string>();

    for (const matchedRule of matchedRules) {
      if (matchedRule.rule.confirmations) {
        for (const confirmation of matchedRule.rule.confirmations) {
          if (confirmation.trim()) {
            confirmations.add(confirmation.trim());
          }
        }
      }
    }

    return Array.from(confirmations);
  }

  calculateScore(
    riskLevel: RiskLevel,
    matchedRules: MatchedRule[],
    change: GitChange
  ): number {
    const riskScores: Record<RiskLevel, number> = {
      'critical': 100,
      'high': 75,
      'medium': 50,
      'low': 25
    };

    let score = riskScores[riskLevel];

    const criticalRules = matchedRules.filter(r => r.rule.riskLevel === 'critical').length;
    const highRules = matchedRules.filter(r => r.rule.riskLevel === 'high').length;
    
    score += criticalRules * 20;
    score += highRules * 10;

    const sizeFactor = Math.min((change.insertions + change.deletions) / 100, 1);
    score = Math.round(score + sizeFactor * 10);

    return Math.min(score, 100);
  }
}
