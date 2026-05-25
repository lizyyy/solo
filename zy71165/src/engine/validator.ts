import type {
  GameState,
  Level,
  FailureReason,
  FailureType,
  Operation,
  ScoreBreakdown,
  SettlementResult,
  IsolationReport,
} from './types';

const BASE_SCORE = 1000;
const LEAK_BONUS = 200;
const USER_PENALTY_PER = 10;
const PRESSURE_PENALTY_PER = 50;
const STEP_PENALTY_PER = 5;
const TIME_BONUS_PER = 2;

function createFailureReason(
  type: FailureType,
  message: string,
  location?: { nodeId?: string; valveId?: string },
  operationIndex?: number
): FailureReason {
  return { type, message, location, operationIndex };
}

export function validateGameState(
  state: GameState,
  level: Level,
  operations: Operation[]
): FailureReason[] {
  const failures: FailureReason[] = [];

  if (state.isolatedLeaks < level.targetIsolatedLeaks) {
    const unisolatedLeaks = state.leaks.filter((l) => !l.isIsolated);
    failures.push(
      createFailureReason(
        'leak_not_isolated',
        `还有 ${unisolatedLeaks.length} 个漏点未隔离`,
        { nodeId: unisolatedLeaks[0]?.nodeId }
      )
    );
  }

  if (state.minPressure < level.minPressure && state.minPressure > 0) {
    const lowPressureNodes = state.nodes.filter(
      (n) => n.pressure > 0 && n.pressure < level.minPressure
    );
    failures.push(
      createFailureReason(
        'pressure_too_low',
        `最低压力 ${state.minPressure} 低于阈值 ${level.minPressure}`,
        { nodeId: lowPressureNodes[0]?.id }
      )
    );
  }

  if (state.affectedUsers > level.maxAffectedUsers) {
    failures.push(
      createFailureReason(
        'too_many_affected',
        `受影响用户 ${state.affectedUsers} 超过限制 ${level.maxAffectedUsers}`
      )
    );
  }

  const closedMainValves = state.valves.filter(
    (v) => v.isMainValve && !v.isOpen
  );
  if (closedMainValves.length > 0) {
    const opIndex = operations.findIndex(
      (op) =>
        op.type === 'valve_toggle' &&
        closedMainValves.some((v) => v.id === op.valveId) &&
        !op.toState
    );
    failures.push(
      createFailureReason(
        'main_valve_closed',
        `主阀门 ${closedMainValves.map((v) => v.id).join('、')} 被误关闭`,
        { valveId: closedMainValves[0]?.id },
        opIndex >= 0 ? opIndex : undefined
      )
    );
  }

  if (level.maxSteps !== undefined && state.stepCount > level.maxSteps) {
    failures.push(
      createFailureReason(
        'steps_exceeded',
        `操作步数 ${state.stepCount} 超过限制 ${level.maxSteps}`
      )
    );
  }

  if (level.timeLimit !== undefined && state.elapsedTime > level.timeLimit) {
    failures.push(
      createFailureReason(
        'time_exceeded',
        `用时 ${Math.round(state.elapsedTime)}s 超过限制 ${level.timeLimit}s`
      )
    );
  }

  return failures;
}

export function calculateScore(
  state: GameState,
  level: Level,
  failures: FailureReason[]
): { score: number; breakdown: ScoreBreakdown } {
  const hasCriticalFailure = failures.some(
    (f) =>
      f.type === 'leak_not_isolated' ||
      f.type === 'main_valve_closed' ||
      f.type === 'steps_exceeded' ||
      f.type === 'time_exceeded'
  );

  if (hasCriticalFailure) {
    return {
      score: 0,
      breakdown: {
        baseScore: 0,
        leakBonus: 0,
        userPenalty: 0,
        pressurePenalty: 0,
        stepPenalty: 0,
        timeBonus: 0,
      },
    };
  }

  const baseScore = BASE_SCORE;
  const leakBonus = state.isolatedLeaks * LEAK_BONUS;
  const userPenalty = state.affectedUsers * USER_PENALTY_PER;

  const pressureDeficit = Math.max(0, level.minPressure - state.minPressure);
  const pressurePenalty =
    state.minPressure > 0 ? Math.round(pressureDeficit * PRESSURE_PENALTY_PER) : 0;

  const baseSteps = level.baseSteps ?? level.targetIsolatedLeaks * 2;
  const excessSteps = Math.max(0, state.stepCount - baseSteps);
  const stepPenalty = excessSteps * STEP_PENALTY_PER;

  let timeBonus = 0;
  if (level.timeLimit !== undefined) {
    const remainingTime = Math.max(0, level.timeLimit - state.elapsedTime);
    timeBonus = Math.round(remainingTime * TIME_BONUS_PER);
  }

  const score = Math.max(
    0,
    baseScore + leakBonus - userPenalty - pressurePenalty - stepPenalty + timeBonus
  );

  return {
    score,
    breakdown: {
      baseScore,
      leakBonus,
      userPenalty,
      pressurePenalty,
      stepPenalty,
      timeBonus,
    },
  };
}

export function generateReport(
  state: GameState,
  level: Level,
  operations: Operation[],
  failures: FailureReason[]
): IsolationReport {
  const affectedUserAreas = state.userAreas
    .filter((u) => u.isAffected)
    .map((u) => u.id);
  const isolatedLeaks = state.leaks.filter((l) => l.isIsolated).map((l) => l.id);
  const closedValves = state.valves.filter((v) => !v.isOpen).map((v) => v.id);

  const recommendations: string[] = [];

  if (failures.length === 0) {
    recommendations.push('隔离方案有效，所有漏点已成功隔离。');
    if (state.affectedUsers === 0) {
      recommendations.push('完美！未对任何用户造成影响。');
    } else if (state.affectedUsers <= level.maxAffectedUsers * 0.3) {
      recommendations.push('影响范围控制良好，仅少量用户受影响。');
    }
  } else {
    failures.forEach((f) => {
      switch (f.type) {
        case 'leak_not_isolated':
          recommendations.push(
            '建议：检查漏点周围的阀门，确保漏点区域与水源完全断开。'
          );
          break;
        case 'pressure_too_low':
          recommendations.push(
            '建议：优化阀门开关策略，减少对主管线的影响以维持管网压力。'
          );
          break;
        case 'too_many_affected':
          recommendations.push(
            '建议：寻找更精确的隔离点，减少不必要的阀门关闭。'
          );
          break;
        case 'main_valve_closed':
          recommendations.push('警告：主阀门不可关闭，请重新打开主阀。');
          break;
        case 'steps_exceeded':
          recommendations.push('建议：优化操作顺序，减少不必要的阀门操作。');
          break;
        case 'time_exceeded':
          recommendations.push('建议：提高决策速度，优先处理关键漏点。');
          break;
      }
    });
  }

  const unnecessaryValves = closedValves.filter((vid) => {
    const valve = state.valves.find((v) => v.id === vid);
    if (!valve || valve.isMainValve) return false;
    return true;
  });
  if (unnecessaryValves.length > 0) {
    recommendations.push(
      `提示：有 ${unnecessaryValves.length} 个阀门可能不需要关闭，请检查是否可以优化。`
    );
  }

  return {
    levelId: level.id,
    levelName: level.name,
    timestamp: Date.now(),
    operations,
    finalState: state,
    affectedUserAreas,
    isolatedLeaks,
    closedValves,
    recommendations,
  };
}

export function settleGame(
  state: GameState,
  level: Level,
  operations: Operation[]
): SettlementResult {
  const failures = validateGameState(state, level, operations);
  const { score, breakdown } = calculateScore(state, level, failures);
  const report = generateReport(state, level, operations, failures);
  const success = failures.length === 0;

  return {
    success,
    score,
    breakdown,
    failureReasons: failures,
    report,
  };
}
