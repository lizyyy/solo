import type {
  GameState,
  Zone,
  DraggableElement,
  CalculationTrace,
  OperationRecord,
  CalculationRule,
  LevelConfig,
} from '../types';
import { defaultOperator, defaultSource } from '../data/mockLevels';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function checkNegativeResources(state: GameState): {
  isNegative: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (state.resources < 0) {
    violations.push(`资源为负数: ${state.resources}`);
  }

  if (state.risk > 100) {
    violations.push(`风险超过阈值: ${state.risk} > 100`);
  }

  if (state.risk < 0) {
    state.risk = 0;
  }

  return {
    isNegative: violations.length > 0,
    violations,
  };
}

export function calculateEffect(
  zone: Zone,
  element: DraggableElement,
  currentState: GameState,
  rules: CalculationRule[],
  operationId: string
): {
  newState: GameState;
  trace: CalculationTrace;
} {
  const steps: Array<{ description: string; value: number }> = [];
  const variables: Record<string, number> = {
    resources: currentState.resources,
    score: currentState.score,
    risk: currentState.risk,
    elementValue: element.baseValue,
    zoneResources: zone.effect.resources || 0,
    zoneScore: zone.effect.score || 0,
    zoneRisk: zone.effect.risk || 0,
  };

  let newResources = currentState.resources;
  let newScore = currentState.score;
  let newRisk = currentState.risk;

  const baseResourceChange = (zone.effect.resources || 0) * element.baseValue;
  const baseScoreChange = (zone.effect.score || 0) * element.baseValue;
  const baseRiskChange = (zone.effect.risk || 0) * element.baseValue;

  steps.push({
    description: `基础变化：资源 ${zone.effect.resources || 0} × ${element.baseValue} = ${baseResourceChange}`,
    value: baseResourceChange,
  });
  steps.push({
    description: `基础变化：分数 ${zone.effect.score || 0} × ${element.baseValue} = ${baseScoreChange}`,
    value: baseScoreChange,
  });
  steps.push({
    description: `基础变化：风险 ${zone.effect.risk || 0} × ${element.baseValue} = ${baseRiskChange}`,
    value: baseRiskChange,
  });

  newResources += baseResourceChange;
  newScore += baseScoreChange;
  newRisk += baseRiskChange;

  let bonusScore = 0;
  let penaltyResources = 0;
  let penaltyRisk = 0;

  rules.forEach((rule) => {
    if (rule.id === 'rule-2-2' && currentState.risk > 50) {
      penaltyRisk += 5;
      steps.push({
        description: `应用规则【${rule.name}】：风险>50，额外+5风险`,
        value: 5,
      });
    }
    if (rule.id === 'rule-3-1' && currentState.risk > 80) {
      penaltyResources -= 10;
      steps.push({
        description: `应用规则【${rule.name}】：风险>80，额外-10资源`,
        value: -10,
      });
    }
  });

  newResources += penaltyResources;
  newRisk += penaltyRisk;

  if (bonusScore > 0) {
    newScore += bonusScore;
    steps.push({
      description: `连击奖励：+${bonusScore}分`,
      value: bonusScore,
    });
  }

  const newState: GameState = {
    resources: Math.round(newResources * 10) / 10,
    score: Math.round(newScore * 10) / 10,
    risk: Math.max(0, Math.round(newRisk * 10) / 10),
    isNegative: false,
  };

  const negativeCheck = checkNegativeResources(newState);
  newState.isNegative = negativeCheck.isNegative;

  variables.newResources = newState.resources;
  variables.newScore = newState.score;
  variables.newRisk = newState.risk;

  const trace: CalculationTrace = {
    id: generateId(),
    operationId,
    formula: zone.effect.formula || '基础加减',
    variables,
    steps,
    result: baseScoreChange + bonusScore,
    ruleId: rules[0]?.id || 'default',
  };

  return { newState, trace };
}

export function createOperationRecord(
  sessionId: string,
  type: 'drag' | 'click',
  element: DraggableElement,
  zone: Zone | null,
  stateBefore: GameState,
  stateAfter: GameState,
  trace: CalculationTrace,
  operator: string = defaultOperator,
  source: string = defaultSource
): OperationRecord {
  return {
    id: generateId(),
    sessionId,
    timestamp: Date.now(),
    type,
    elementId: element.id,
    elementLabel: element.label,
    zoneId: zone?.id,
    zoneName: zone?.name,
    stateBefore: { ...stateBefore },
    stateAfter: { ...stateAfter },
    calculationTrace: trace,
    operator,
    source,
  };
}

export function createInitialSession(level: LevelConfig, operator: string = defaultOperator): {
  sessionId: string;
  initialState: GameState;
} {
  const state = { ...level.initialState };
  const negativeCheck = checkNegativeResources(state);
  state.isNegative = negativeCheck.isNegative;

  return {
    sessionId: generateId(),
    initialState: state,
  };
}

export function getStateChangeSummary(
  before: GameState,
  after: GameState
): {
  resources: number;
  score: number;
  risk: number;
} {
  return {
    resources: Math.round((after.resources - before.resources) * 10) / 10,
    score: Math.round((after.score - before.score) * 10) / 10,
    risk: Math.round((after.risk - before.risk) * 10) / 10,
  };
}
