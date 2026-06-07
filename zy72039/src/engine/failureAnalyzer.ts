import type { GameRecord, GameConfig, FailureReason } from '../types';

export interface FailureAnalysisResult {
  reason: FailureReason;
  detail: string;
  suggestions: string[];
}

export function analyzeFailure(
  record: GameRecord,
  config: GameConfig
): FailureAnalysisResult {
  const reasons: string[] = [];
  const suggestions: string[] = [];
  let isRuleIssue = false;
  let isSpeedIssue = false;

  if (config.ruleViolationPatterns.some(p => 
    record.note.includes(p) || 
    String(record.rawValue || '').includes(p)
  )) {
    isRuleIssue = true;
    reasons.push('输入内容包含规则违规关键词');
    suggestions.push('建议：重新讲解游戏规则，特别强调载荷输入的正确格式');
  }
  
  if (record.flags.includes('misoperation')) {
    isRuleIssue = true;
    reasons.push('疑似误操作（输入过快）');
    suggestions.push('建议：指导学生等待系统响应后再输入，避免连续点击');
  }
  
  if (record.processedValue !== null && record.processedValue > config.maxLoad) {
    isRuleIssue = true;
    reasons.push(`载荷超过最大限制（输入${record.processedValue}，限制${config.maxLoad}）`);
    suggestions.push(`建议：明确告知最大载荷值为${config.maxLoad}，超过则判定失败`);
  }

  if (record.processedValue === null) {
    isRuleIssue = true;
    reasons.push('输入值无法解析为有效数字');
    suggestions.push('建议：指导学生输入有效的数字，避免空值或文字');
  }

  if (record.responseTime !== null && record.responseTime >= config.slowOperationThreshold) {
    isSpeedIssue = true;
    const timeUsed = (record.responseTime / 1000).toFixed(1);
    const timeLimit = (config.timeLimitPerRound / 1000).toFixed(0);
    reasons.push(`响应超时（用时${timeUsed}秒，限制${timeLimit}秒）`);
    suggestions.push('建议：加强熟练度训练，提高反应速度；或适当延长时间限制');
  }

  let reason: FailureReason = null;
  if (isRuleIssue && isSpeedIssue) {
    reason = 'both';
  } else if (isRuleIssue) {
    reason = 'rule_misunderstanding';
  } else if (isSpeedIssue) {
    reason = 'slow_operation';
  }

  if (reasons.length === 0) {
    reasons.push('未识别到具体失败原因');
    suggestions.push('建议：人工复核该条记录的具体情况');
  }

  return {
    reason,
    detail: reasons.join('；'),
    suggestions,
  };
}

export function getFailureTypeLabel(reason: FailureReason): string {
  if (!reason) return '';
  const labels: Record<Exclude<FailureReason, null>, string> = {
    rule_misunderstanding: '规则未理解',
    slow_operation: '操作超时',
    both: '规则未理解 + 操作超时',
  };
  return labels[reason];
}

export function getFailureTypeDescription(reason: FailureReason): string {
  if (!reason) return '';
  const descriptions: Record<Exclude<FailureReason, null>, string> = {
    rule_misunderstanding: '学生可能没有正确理解游戏规则，导致输入不符合要求。建议重新讲解规则要点。',
    slow_operation: '学生操作速度过慢，超过了规定的时间限制。建议加强练习提高熟练度。',
    both: '同时存在规则理解问题和操作速度问题。建议双管齐下，既要讲清规则也要加强练习。',
  };
  return descriptions[reason];
}

export interface FailureStats {
  total: number;
  ruleMisunderstanding: number;
  slowOperation: number;
  both: number;
  unknown: number;
}

export function calculateFailureStats(records: GameRecord[]): FailureStats {
  const failedRecords = records.filter(r => !r.isSuccess);
  const stats: FailureStats = {
    total: failedRecords.length,
    ruleMisunderstanding: 0,
    slowOperation: 0,
    both: 0,
    unknown: 0,
  };

  failedRecords.forEach(r => {
    switch (r.failureReason) {
      case 'rule_misunderstanding':
        stats.ruleMisunderstanding++;
        break;
      case 'slow_operation':
        stats.slowOperation++;
        break;
      case 'both':
        stats.both++;
        break;
      default:
        stats.unknown++;
    }
  });

  return stats;
}
