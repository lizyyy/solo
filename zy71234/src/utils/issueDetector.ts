import type { PartyState, Card, Issue, SplitDetail } from '../types';

export function detectSplitMismatch(
  splits: SplitDetail[],
  cards: Card[]
): Issue | null {
  const totalSplit = splits.reduce((sum, s) => sum + s.finalSplit, 0);
  
  if (totalSplit < 95 || totalSplit > 105) {
    return {
      id: `issue-split-${Date.now()}`,
      type: 'split_mismatch',
      severity: totalSplit < 90 || totalSplit > 110 ? 'critical' : 'major',
      description: `分成比例总和异常：${totalSplit.toFixed(1)}%`,
      source: 'split_calculation',
      rawData: `原始分成总和: ${totalSplit.toFixed(1)}%`,
      processedResult: `理想范围: 95%-105%，当前${totalSplit < 100 ? '偏低' : '偏高'}${Math.abs(100 - totalSplit).toFixed(1)}个百分点`,
      explanation: totalSplit < 100 
        ? '分成比例不足100%意味着有部分收入去向不明，可能导致后续纠纷。请检查是否遗漏了某些参与方的分成。'
        : '分成比例超过100%意味着重复计算或错误叠加，需要重新核对各张卡牌的效果。'
    };
  }
  
  return null;
}

export function detectMissingRights(
  parties: PartyState[],
  cards: Card[]
): Issue[] {
  const issues: Issue[] = [];
  const recordingParty = parties.find(p => p.type === 'recording');
  
  if (recordingParty && !recordingParty.rights.includes('mechanical_right')) {
    const hasRightCard = cards.some(c => 
      c.effect.type === 'right_add' && c.effect.right === 'mechanical_right'
    );
    
    if (!hasRightCard || !recordingParty.rights.includes('mechanical_right')) {
      issues.push({
        id: `issue-right-${Date.now()}`,
        type: 'right_missing',
        severity: 'major',
        description: '录音方缺少机械复制权',
        source: recordingParty.id,
        sourceCardId: cards.find(c => c.effect.right === 'missing_mechanical')?.id,
        rawData: `录音方当前权利: [${recordingParty.rights.join(', ') || '无'}]`,
        processedResult: '缺少: mechanical_right (机械复制权)',
        explanation: '机械复制权是制作CD、数字下载等复制品的核心权利。缺少此项权利意味着录音方无法从实体唱片和数字下载中获得版税收入。'
      });
    }
  }
  
  return issues;
}

export function detectDeductionIssues(
  cards: Card[],
  deductions: Array<{ name: string; amount: number; cardId: string }>
): Issue[] {
  const issues: Issue[] = [];
  const platformCards = cards.filter(c => c.type === 'platform');
  
  platformCards.forEach(platformCard => {
    const hasCorrespondingDeduction = deductions.some(d => d.cardId === platformCard.id);
    
    if (!hasCorrespondingDeduction) {
      issues.push({
        id: `issue-deduction-${Date.now()}-${platformCard.id}`,
        type: 'deduction_ignored',
        severity: 'minor',
        description: `平台扣费未计入: ${platformCard.name}`,
        source: platformCard.id,
        sourceCardId: platformCard.id,
        rawData: `使用了平台卡牌: ${platformCard.name}`,
        processedResult: `应扣除平台费用: ${platformCard.effect.value}%，但未在结算中体现`,
        explanation: '平台合作必然会产生渠道费用。虽然这是小额问题，但长期累积会显著影响最终收益。'
      });
    }
  });
  
  return issues;
}

export function detectAllIssues(
  splits: SplitDetail[],
  parties: PartyState[],
  cards: Card[],
  deductions: Array<{ name: string; amount: number; cardId: string }>
): Issue[] {
  const issues: Issue[] = [];
  
  const splitIssue = detectSplitMismatch(splits, cards);
  if (splitIssue) issues.push(splitIssue);
  
  const rightIssues = detectMissingRights(parties, cards);
  issues.push(...rightIssues);
  
  const deductionIssues = detectDeductionIssues(cards, deductions);
  issues.push(...deductionIssues);
  
  return issues.sort((a, b) => {
    const severityOrder = { critical: 0, major: 1, minor: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-500 bg-red-500/20 border-red-500';
    case 'major': return 'text-yellow-500 bg-yellow-500/20 border-yellow-500';
    case 'minor': return 'text-blue-400 bg-blue-400/20 border-blue-400';
    default: return 'text-gray-400 bg-gray-400/20 border-gray-400';
  }
}

export function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'critical': return '严重';
    case 'major': return '重要';
    case 'minor': return '轻微';
    default: return '未知';
  }
}

export function getIssueTypeLabel(type: string): string {
  switch (type) {
    case 'split_mismatch': return '分成比例异常';
    case 'right_missing': return '权利缺失';
    case 'deduction_ignored': return '扣费忽略';
    default: return '未知问题';
  }
}
