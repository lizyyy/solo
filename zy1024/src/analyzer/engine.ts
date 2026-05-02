import { GitCollector } from '../git/collector';
import { ConfigParser } from '../config/parser';
import { RuleMatcher } from '../matcher/rule-matcher';
import {
  GitChange,
  ReleaseScopeConfig,
  FileAnalysis,
  GroupedAnalysis,
  ImpactReport,
  RiskLevel,
  BlockingLevel,
  ScanOptions
} from '../types';
import { getSampleDataset, sampleDatasets } from '../samples';

export interface AnalysisResult {
  report: ImpactReport;
  config: ReleaseScopeConfig;
}

export class AnalysisEngine {
  private config: ReleaseScopeConfig;

  constructor(config: ReleaseScopeConfig) {
    this.config = config;
  }

  async analyze(options: ScanOptions): Promise<AnalysisResult> {
    let changes: GitChange[] = [];

    if (options.useSampleData) {
      const sampleKey = options.sampleKey || 'frontend-backend';
      const sample = getSampleDataset(sampleKey);
      if (!sample) {
        throw new Error(`Sample dataset not found: ${sampleKey}. Available samples: ${sampleDatasets.map(s => s.key).join(', ')}`);
      }
      changes = sample.changes;
    } else {
      const collector = new GitCollector({
        projectDir: options.projectDir,
        fromRef: options.fromRef,
        toRef: options.toRef,
        includeUncommitted: true
      });
      
      if (!(await collector.isGitRepo())) {
        throw new Error(`Not a git repository: ${options.projectDir}`);
      }
      
      changes = await collector.getChanges();
    }

    return this.analyzeChanges(changes, options);
  }

  private analyzeChanges(changes: GitChange[], options: ScanOptions): AnalysisResult {
    const matcher = new RuleMatcher(
      this.config.modules,
      this.config.rules,
      this.config.defaultRiskLevel || 'medium'
    );

    const fileAnalyses: FileAnalysis[] = [];

    for (const change of changes) {
      const moduleMatch = matcher.matchModule(change);
      const matchedRules = matcher.matchRules(change, moduleMatch?.module || null);
      
      const riskLevel = matcher.calculateRiskLevel(change, matchedRules, moduleMatch);
      const checkCommands = matcher.collectCheckCommands(
        matchedRules,
        moduleMatch,
        this.config.globalCheckCommands || []
      );
      const confirmations = matcher.collectConfirmations(matchedRules);
      const score = matcher.calculateScore(riskLevel, matchedRules, change);

      fileAnalyses.push({
        change,
        module: moduleMatch?.module.name || null,
        owners: moduleMatch?.module.owners || [],
        riskLevel,
        matchedRules,
        checkCommands,
        confirmations,
        score
      });
    }

    const grouped = this.groupAnalyses(fileAnalyses);
    const allCheckCommands = this.collectAllCheckCommands(fileAnalyses);
    const allConfirmations = this.collectAllConfirmations(fileAnalyses);

    const report: ImpactReport = {
      projectName: this.config.projectName,
      generatedAt: new Date().toISOString(),
      scope: {
        fromRef: options.fromRef || null,
        toRef: options.toRef || null,
        isWorkingDir: !options.fromRef && !options.useSampleData
      },
      summary: this.buildSummary(fileAnalyses),
      grouped,
      allCheckCommands,
      allConfirmations,
      files: fileAnalyses
    };

    return {
      report,
      config: this.config
    };
  }

  private groupAnalyses(files: FileAnalysis[]): GroupedAnalysis {
    const byModule = new Map<string, FileAnalysis[]>();
    const byOwner = new Map<string, FileAnalysis[]>();
    const byRiskLevel = new Map<RiskLevel, FileAnalysis[]>();

    for (const file of files) {
      if (file.module) {
        if (!byModule.has(file.module)) {
          byModule.set(file.module, []);
        }
        byModule.get(file.module)!.push(file);
      }

      for (const owner of file.owners) {
        if (!byOwner.has(owner)) {
          byOwner.set(owner, []);
        }
        byOwner.get(owner)!.push(file);
      }

      if (!byRiskLevel.has(file.riskLevel)) {
        byRiskLevel.set(file.riskLevel, []);
      }
      byRiskLevel.get(file.riskLevel)!.push(file);
    }

    return { byModule, byOwner, byRiskLevel };
  }

  private collectAllCheckCommands(files: FileAnalysis[]): string[] {
    const commandPriority: Record<BlockingLevel, number> = {
      'required': 3,
      'recommended': 2,
      'optional': 1
    };

    const commandInfo = new Map<string, { priority: number; source: string }>();

    for (const file of files) {
      for (const ruleMatch of file.matchedRules) {
        const priority = commandPriority[ruleMatch.rule.blockingLevel];
        for (const cmd of ruleMatch.rule.checkCommands) {
          if (!cmd.trim()) continue;
          
          const existing = commandInfo.get(cmd.trim());
          if (!existing || existing.priority < priority) {
            commandInfo.set(cmd.trim(), {
              priority,
              source: ruleMatch.rule.name
            });
          }
        }
      }

      if (file.module) {
        const moduleConfig = this.config.modules.find(m => m.name === file.module);
        if (moduleConfig) {
          for (const cmd of moduleConfig.defaultCheckCommands) {
            if (!cmd.trim()) continue;
            
            const existing = commandInfo.get(cmd.trim());
            if (!existing || existing.priority < 2) {
              commandInfo.set(cmd.trim(), {
                priority: 2,
                source: `模块: ${file.module}`
              });
            }
          }
        }
      }
    }

    for (const cmd of this.config.globalCheckCommands || []) {
      if (!cmd.trim()) continue;
      
      const existing = commandInfo.get(cmd.trim());
      if (!existing) {
        commandInfo.set(cmd.trim(), {
          priority: 2,
          source: '全局配置'
        });
      }
    }

    return Array.from(commandInfo.entries())
      .sort((a, b) => b[1].priority - a[1].priority)
      .map(([cmd]) => cmd);
  }

  private collectAllConfirmations(files: FileAnalysis[]): string[] {
    const confirmations = new Set<string>();
    
    for (const file of files) {
      for (const confirmation of file.confirmations) {
        confirmations.add(confirmation);
      }
    }

    return Array.from(confirmations);
  }

  private buildSummary(files: FileAnalysis[]): ImpactReport['summary'] {
    let criticalFiles = 0;
    let highRiskFiles = 0;
    let mediumRiskFiles = 0;
    let lowRiskFiles = 0;
    let totalInsertions = 0;
    let totalDeletions = 0;

    for (const file of files) {
      switch (file.riskLevel) {
        case 'critical': criticalFiles++; break;
        case 'high': highRiskFiles++; break;
        case 'medium': mediumRiskFiles++; break;
        case 'low': lowRiskFiles++; break;
      }
      totalInsertions += file.change.insertions;
      totalDeletions += file.change.deletions;
    }

    return {
      totalFiles: files.length,
      criticalFiles,
      highRiskFiles,
      mediumRiskFiles,
      lowRiskFiles,
      totalInsertions,
      totalDeletions
    };
  }
}
