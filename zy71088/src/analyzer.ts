import { 
  FlagDefinition, 
  FlagMatch, 
  FlagAnalysis, 
  RiskLevel, 
  ScanOptions, 
  AnalysisResult 
} from './types';
import { RISK_REASONS, RISK_LEVEL_WEIGHTS, VERSION } from './constants';

export function detectDefaultValueInversion(
  flag: FlagDefinition,
  matches: FlagMatch[],
  assumedDefault?: boolean
): { inverted: boolean; reason: string } {
  const effectiveDefault = assumedDefault !== undefined ? assumedDefault : flag.defaultValue;
  
  const negatedCount = matches.filter(m => m.isNegated).length;
  const totalCount = matches.length;
  
  if (totalCount === 0) {
    return { inverted: false, reason: 'No matches found' };
  }

  const negatedRatio = negatedCount / totalCount;
  
  if (effectiveDefault === true && negatedRatio > 0.7) {
    return { 
      inverted: true, 
      reason: `默认值为 true，但 ${(negatedRatio * 100).toFixed(0)}% 的使用是否定形式（!flag），建议反转逻辑清理` 
    };
  }
  
  if (effectiveDefault === false && negatedRatio < 0.3 && totalCount > 3) {
    const positiveCount = totalCount - negatedCount;
    const positiveRatio = positiveCount / totalCount;
    if (positiveRatio > 0.7) {
      return { 
        inverted: true, 
        reason: `默认值为 false，但 ${(positiveRatio * 100).toFixed(0)}% 的使用是肯定形式，可能存在默认值反转` 
      };
    }
  }

  return { inverted: false, reason: 'Usage patterns align with default value' };
}

export function detectDynamicNameUsage(flag: FlagDefinition, matches: FlagMatch[]): boolean {
  return matches.some(m => m.matchType === 'dynamic');
}

export function calculateRiskLevel(
  flag: FlagDefinition,
  matches: FlagMatch[],
  analysis: {
    defaultValueInverted: boolean;
    dynamicNameUsed: boolean;
  }
): { level: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  let riskScore = 0;

  if (flag.status === 'active') {
    riskScore += 3;
    reasons.push(RISK_REASONS.ACTIVE_EXPERIMENT);
  }

  if (flag.status === 'unknown') {
    riskScore += 1;
    reasons.push(RISK_REASONS.UNKNOWN_STATUS);
  }

  if (analysis.defaultValueInverted) {
    riskScore += 2;
    reasons.push(RISK_REASONS.DEFAULT_VALUE_INVERTED);
  }

  if (analysis.dynamicNameUsed) {
    riskScore += 3;
    reasons.push(RISK_REASONS.DYNAMIC_NAME);
  }

  if (matches.length > 20) {
    riskScore += 2;
    reasons.push(`${RISK_REASONS.HIGH_OCCURRENCE} (${matches.length}次)`);
  } else if (matches.length > 10) {
    riskScore += 1;
  }

  const uniqueFiles = new Set(matches.map(m => m.filePath)).size;
  if (uniqueFiles > 5) {
    riskScore += 1;
    reasons.push(`${RISK_REASONS.MULTIPLE_FILES} (${uniqueFiles}个文件)`);
  }

  const hasNegated = matches.some(m => m.isNegated);
  const hasPositive = matches.some(m => !m.isNegated);
  if (hasNegated && hasPositive && matches.length > 5) {
    riskScore += 1;
    reasons.push(RISK_REASONS.NEGATED_USAGE);
  }

  let level: RiskLevel;
  if (riskScore >= 6) {
    level = 'critical';
  } else if (riskScore >= 4) {
    level = 'high';
  } else if (riskScore >= 2) {
    level = 'medium';
  } else if (riskScore >= 1) {
    level = 'low';
  } else {
    level = 'safe';
  }

  return { level, reasons };
}

export function generateRecommendation(
  flag: FlagDefinition,
  riskLevel: RiskLevel,
  matchCount: number
): string {
  if (matchCount === 0) {
    return '代码中未找到使用，可以安全删除 flag 定义';
  }

  if (flag.status === 'active') {
    return '实验仍在进行中，建议等待实验结束后再清理';
  }

  if (flag.status === 'archived') {
    return '实验已归档，建议优先清理此 flag';
  }

  switch (riskLevel) {
    case 'safe':
      return `可以安全删除，共 ${matchCount} 处引用`;
    case 'low':
      return `建议删除，改动量较小 (${matchCount} 处)`;
    case 'medium':
      return `需要谨慎操作，涉及 ${matchCount} 处引用，请仔细核对后删除`;
    case 'high':
      return '高风险操作，建议先确认实验状态，进行代码审查后再清理';
    case 'critical':
      return '极高风险！存在动态 flag 或逻辑反转，建议手动分析后再决定';
    default:
      return '请人工确认后再操作';
  }
}

export function canRemoveFlag(
  flag: FlagDefinition,
  riskLevel: RiskLevel,
  matchCount: number
): boolean {
  if (matchCount === 0) return true;
  if (flag.status === 'active') return false;
  if (riskLevel === 'critical') return false;
  if (riskLevel === 'high' && flag.status !== 'completed' && flag.status !== 'archived') return false;
  return true;
}

export function analyzeFlag(
  flag: FlagDefinition,
  allMatches: FlagMatch[],
  options: ScanOptions
): FlagAnalysis {
  const matches = allMatches.filter(m => m.flagName === flag.name);
  const uniqueFiles = new Set(matches.map(m => m.filePath));
  
  const { inverted: defaultValueInverted } = detectDefaultValueInversion(
    flag, 
    matches, 
    options.defaultAssumedValue
  );
  
  const dynamicNameUsed = detectDynamicNameUsage(flag, matches);
  const { level: riskLevel, reasons: riskReasons } = calculateRiskLevel(flag, matches, {
    defaultValueInverted,
    dynamicNameUsed,
  });

  const canRemove = canRemoveFlag(flag, riskLevel, matches.length);
  const recommendation = generateRecommendation(flag, riskLevel, matches.length);

  return {
    flag,
    matches,
    totalOccurrences: matches.length,
    fileCount: uniqueFiles.size,
    canRemove,
    riskLevel,
    riskReasons,
    recommendation,
    defaultValueInverted,
    dynamicNameUsed,
  };
}

export function analyzeAllFlags(
  flagDefinitions: FlagDefinition[],
  matches: FlagMatch[],
  options: ScanOptions,
  filesScanned: string[],
  errors: string[],
  startTime: number
): AnalysisResult {
  const flagAnalyses = flagDefinitions.map(flag => analyzeFlag(flag, matches, options));
  
  const flagsCanRemove = flagAnalyses.filter(f => f.canRemove).length;
  const flagsWithRisk = flagAnalyses.filter(f => 
    f.riskLevel === 'high' || f.riskLevel === 'critical'
  ).length;

  const fileMatchCounts: Record<string, number> = {};
  matches.forEach(m => {
    fileMatchCounts[m.filePath] = (fileMatchCounts[m.filePath] || 0) + 1;
  });

  const files = Object.entries(fileMatchCounts).map(([filePath, matchCount]) => ({
    path: filePath,
    language: flagAnalyses.find(a => a.matches.some(m => m.filePath === filePath))?.matches[0]?.language || 'other',
    matchCount,
  }));

  return {
    summary: {
      totalFlags: flagDefinitions.length,
      flagsScanned: flagDefinitions.length,
      flagsCanRemove,
      flagsWithRisk,
      totalMatches: matches.length,
      filesScanned: filesScanned.length,
      scanDuration: Date.now() - startTime,
    },
    flags: flagAnalyses.sort((a, b) => 
      RISK_LEVEL_WEIGHTS[b.riskLevel] - RISK_LEVEL_WEIGHTS[a.riskLevel]
    ),
    files: files.sort((a, b) => b.matchCount - a.matchCount),
    errors,
    metadata: {
      scanDate: new Date().toISOString(),
      version: VERSION,
      options,
    },
  };
}
