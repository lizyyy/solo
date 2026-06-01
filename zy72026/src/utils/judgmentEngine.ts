import type {
  WarehouseReceiptProblem,
  PlayerChoiceRecord,
  BusinessRule,
  JudgmentResult,
  JudgmentStep,
  ProblemOption,
} from '../types';

function getOptionLabel(problem: WarehouseReceiptProblem, optionId: string | null): string {
  if (!optionId) return '未选择';
  const option = problem.options.find((o) => o.id === optionId);
  return option?.label || optionId;
}

function getRuleText(rules: BusinessRule[], ruleCode: string): string {
  const rule = rules.find((r) => r.code === ruleCode);
  return rule ? `${rule.code} ${rule.title}` : ruleCode;
}

export function deduplicateChoices(choices: PlayerChoiceRecord[]): PlayerChoiceRecord[] {
  const seen = new Map<string, PlayerChoiceRecord>();
  for (const choice of choices) {
    const key = `${choice.problemId}-${choice.timestamp}-${choice.optionId}`;
    if (!seen.has(key)) {
      seen.set(key, choice);
    }
  }
  return Array.from(seen.values());
}

export function judgeProblem(
  problem: WarehouseReceiptProblem,
  choice: PlayerChoiceRecord | null,
  rules: BusinessRule[]
): JudgmentResult {
  const chain: JudgmentStep[] = [];
  const timeLimitMs = problem.timeLimit * 1000;

  chain.push({
    step: '检查玩家是否做出选择',
    condition: 'playerChoice != null && playerChoice.optionId != null',
    result: choice?.optionId != null,
  });

  if (!choice || choice.optionId == null) {
    return {
      isCorrect: false,
      failureType: 'operation_timeout',
      scoreChange: problem.scoring.timeout,
      reasons: ['玩家未在规定时间内做出任何操作选择（空值）'],
      ruleReferences: ['RULE-TIMEOUT-001'],
      judgmentChain: chain,
    };
  }

  chain.push({
    step: '检查响应时间是否超时',
    condition: `responseTime (${choice.responseTime}ms) <= timeLimit (${timeLimitMs}ms)`,
    result: choice.responseTime <= timeLimitMs,
    note: `边界值：${choice.responseTime}ms vs ${timeLimitMs}ms，差值：${timeLimitMs - choice.responseTime}ms`,
  });

  const isTimeout = choice.responseTime > timeLimitMs;

  chain.push({
    step: '检查操作选择是否正确',
    condition: `optionId (${choice.optionId}) == correctOptionId (${problem.correctOptionId})`,
    result: choice.optionId === problem.correctOptionId,
  });

  const isCorrectChoice = choice.optionId === problem.correctOptionId;

  if (isTimeout) {
    const timeoutReasons: string[] = [
      `操作超时：响应时间 ${choice.responseTime}ms 超过限制 ${timeLimitMs}ms（超出 ${choice.responseTime - timeLimitMs}ms）`,
    ];

    if (isCorrectChoice) {
      timeoutReasons.push('注意：虽然选择本身是正确的，但因超时仍判定失败');
    } else {
      timeoutReasons.push(
        `同时，选择的操作"${getOptionLabel(problem, choice.optionId)}"也不符合规则`
      );
    }

    return {
      isCorrect: false,
      failureType: 'operation_timeout',
      scoreChange: problem.scoring.timeout,
      reasons: timeoutReasons,
      ruleReferences: ['RULE-TIMEOUT-001', ...problem.ruleReferences],
      judgmentChain: chain,
    };
  }

  if (!isCorrectChoice) {
    const correctOption = problem.options.find((o) => o.id === problem.correctOptionId);
    const chosenOption = problem.options.find((o) => o.id === choice.optionId);
    const ruleTexts = problem.ruleReferences.map((r) => getRuleText(rules, r)).join('；');

    return {
      isCorrect: false,
      failureType: 'rule_misunderstanding',
      scoreChange: problem.scoring.wrong,
      reasons: [
        `规则误解：选择了"${chosenOption?.label || choice.optionId}"，正确操作应为"${correctOption?.label || problem.correctOptionId}"`,
        `违反规则：${ruleTexts}`,
      ],
      ruleReferences: problem.ruleReferences,
      judgmentChain: chain,
    };
  }

  return {
    isCorrect: true,
    scoreChange: problem.scoring.correct,
    reasons: ['操作正确，符合业务规则'],
    ruleReferences: problem.ruleReferences,
    judgmentChain: chain,
  };
}

export function validateChoice(choice: PlayerChoiceRecord | null): boolean {
  if (!choice) return false;
  if (!choice.problemId) return false;
  if (choice.responseTime < 0) return false;
  return true;
}

export function getFailureTypeLabel(type: 'rule_misunderstanding' | 'operation_timeout' | undefined): string {
  switch (type) {
    case 'rule_misunderstanding':
      return '规则误解';
    case 'operation_timeout':
      return '操作超时';
    default:
      return '未知';
  }
}
