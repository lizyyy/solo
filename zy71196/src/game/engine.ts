import type {
  GameState,
  RoofMap,
  ToolType,
  GameAction,
  LeakPoint,
  ScoreBreakdown,
  LevelConfig,
} from './types';
import { TOOL_CONFIG, GAME_CONSTANTS } from './config';
import { generateRoofMap, cloneRoofMap } from './roof';
import { simulateRainfall } from './rainfall';
import { calculateFinalScore } from './scoring';

const generateId = (): string => Math.random().toString(36).substring(2, 9);

export const createInitialState = (levelConfig: LevelConfig): GameState => {
  const roofMap = generateRoofMap(levelConfig);
  
  return {
    phase: 'playing',
    levelId: levelConfig.id,
    currentRound: 1,
    totalRounds: levelConfig.totalRounds,
    actionPoints: levelConfig.maxActionPoints,
    maxActionPoints: levelConfig.maxActionPoints,
    score: 0,
    scoreBreakdown: {
      inspectionScore: 0,
      resolutionScore: 0,
      efficiencyScore: 0,
      timeBonus: 0,
      leakPenalty: 0,
      total: 0,
    },
    rainfallIntensity: levelConfig.rainfallPattern[0],
    rainfallPattern: levelConfig.rainfallPattern,
    roofMap,
    selectedTool: 'inspect',
    inspectedDrains: [],
    resolvedIssues: [],
    failed: false,
    leakPoints: [],
    actions: [],
    isPaused: false,
    isReplayMode: false,
    replaySpeed: 1,
    currentReplayIndex: 0,
  };
};

export const createStateSnapshot = (state: GameState): GameAction['stateSnapshot'] => {
  const waterLevels: Record<string, number> = {};
  const blockages: Record<string, number> = {};

  state.roofMap.lowAreas.forEach((la) => {
    waterLevels[la.id] = la.waterLevel;
  });
  state.roofMap.drains.forEach((d) => {
    blockages[d.id] = d.blockageSeverity;
  });

  return {
    actionPoints: state.actionPoints,
    score: state.score,
    inspectedDrains: [...state.inspectedDrains],
    resolvedIssues: [...state.resolvedIssues],
    waterLevels,
    blockages,
  };
};

export const addAction = (
  state: GameState,
  type: GameAction['type'],
  payload: GameAction['payload']
): GameState => {
  const action: GameAction = {
    timestamp: Date.now(),
    round: state.currentRound,
    type,
    payload,
    stateSnapshot: createStateSnapshot(state),
  };

  return {
    ...state,
    actions: [...state.actions, action],
  };
};

export const useTool = (
  state: GameState,
  tool: ToolType,
  targetId: string,
  targetType: 'drain' | 'lowarea'
): {
  newState: GameState;
  success: boolean;
  message: string;
} => {
  if (state.phase !== 'playing' || state.isPaused) {
    return { newState: state, success: false, message: '游戏未进行中' };
  }

  const toolConfig = TOOL_CONFIG[tool];
  if (state.actionPoints < toolConfig.cost) {
    return { newState: state, success: false, message: '行动点数不足' };
  }

  let newRoofMap = cloneRoofMap(state.roofMap);
  let success = false;
  let message = '';
  let newInspectedDrains = [...state.inspectedDrains];
  let newResolvedIssues = [...state.resolvedIssues];

  switch (tool) {
    case 'inspect': {
      if (targetType === 'drain') {
        const drain = newRoofMap.drains.find((d) => d.id === targetId);
        if (drain && !drain.inspected) {
          drain.inspected = true;
          newInspectedDrains.push(drain.id);
          success = true;
          if (drain.isBlocked) {
            message = `发现排水口堵塞，堵塞程度: ${drain.blockageSeverity}%`;
          } else {
            message = '排水口状态正常';
          }
        } else if (drain?.inspected) {
          message = '该排水口已检查过';
        }
      } else if (targetType === 'lowarea') {
        const lowArea = newRoofMap.lowAreas.find((l) => l.id === targetId);
        if (lowArea && !lowArea.inspected) {
          lowArea.inspected = true;
          success = true;
          message = `低洼区水位: ${lowArea.waterLevel}%`;
        } else if (lowArea?.inspected) {
          message = '该低洼区已检查过';
        }
      }
      break;
    }

    case 'unclog': {
      if (targetType === 'drain') {
        const drain = newRoofMap.drains.find((d) => d.id === targetId);
        if (drain && drain.isBlocked) {
          drain.isBlocked = false;
          drain.blockageSeverity = 0;
          drain.resolved = true;
          newResolvedIssues.push(drain.id);
          success = true;
          message = '排水口疏通成功';
        } else if (drain && !drain.isBlocked) {
          message = '该排水口未堵塞';
        }
      } else {
        message = '疏通工具只能用于排水口';
      }
      break;
    }

    case 'pump': {
      if (targetType === 'lowarea') {
        const lowArea = newRoofMap.lowAreas.find((l) => l.id === targetId);
        if (lowArea && lowArea.waterLevel > 0) {
          lowArea.waterLevel = Math.max(0, lowArea.waterLevel - 60);
          lowArea.pumped = true;
          success = true;
          message = `抽水完成，剩余水位: ${lowArea.waterLevel}%`;
        } else if (lowArea && lowArea.waterLevel === 0) {
          message = '该低洼区没有积水';
        }
      } else {
        message = '抽水工具只能用于低洼区';
      }
      break;
    }

    case 'reinforce': {
      if (targetType === 'drain') {
        const drain = newRoofMap.drains.find((d) => d.id === targetId);
        if (drain) {
          drain.flowRate = Math.min(20, drain.flowRate + 5);
          success = true;
          message = '排水口加固完成，排水能力提升';
        }
      } else if (targetType === 'lowarea') {
        const lowArea = newRoofMap.lowAreas.find((l) => l.id === targetId);
        if (lowArea) {
          lowArea.maxCapacity = Math.min(150, lowArea.maxCapacity + 20);
          success = true;
          message = '低洼区加固完成，容量提升';
        }
      }
      break;
    }
  }

  if (!success) {
    return { newState: state, success: false, message };
  }

  const newActionPoints = state.actionPoints - toolConfig.cost;

  let newState: GameState = {
    ...state,
    roofMap: newRoofMap,
    actionPoints: newActionPoints,
    inspectedDrains: newInspectedDrains,
    resolvedIssues: newResolvedIssues,
  };

  newState = addAction(newState, 'tool_use', {
    tool,
    targetId,
    targetType,
    success,
    message,
  });

  return { newState, success: true, message };
};

export const endRound = (state: GameState): {
  newState: GameState;
  newLeaks: LeakPoint[];
  roundEnded: boolean;
  gameEnded: boolean;
} => {
  if (state.phase !== 'playing' || state.isPaused) {
    return { newState: state, newLeaks: [], roundEnded: false, gameEnded: false };
  }

  const { updatedRoofMap, newLeaks } = simulateRainfall(
    state.roofMap,
    state.rainfallIntensity,
    state.currentRound
  );

  const allLeaks = [...state.leakPoints, ...newLeaks];
  
  const failed = newLeaks.length > 0;
  const failureReason = failed
    ? `第 ${state.currentRound} 回合发生漏水，共 ${newLeaks.length} 处`
    : undefined;

  const nextRound = state.currentRound + 1;
  const gameEnded = failed || nextRound > state.totalRounds;
  
  const nextRainfallIntensity = gameEnded
    ? state.rainfallIntensity
    : state.rainfallPattern[nextRound - 1] || state.rainfallPattern[state.rainfallPattern.length - 1];

  let newState: GameState = {
    ...state,
    roofMap: updatedRoofMap,
    currentRound: nextRound,
    rainfallIntensity: nextRainfallIntensity,
    leakPoints: allLeaks,
    failed,
    failureReason,
    actionPoints: gameEnded ? state.actionPoints : state.maxActionPoints,
  };

  if (gameEnded) {
    const scoreBreakdown = calculateFinalScore(
      updatedRoofMap,
      state.actionPoints,
      state.maxActionPoints,
      allLeaks,
      state.currentRound,
      state.totalRounds,
      failed
    );

    newState = {
      ...newState,
      phase: 'result',
      score: scoreBreakdown.total,
      scoreBreakdown,
    };
  }

  newState = addAction(newState, 'round_end', {
    success: !failed,
    message: failureReason || `回合 ${state.currentRound} 结束`,
  });

  if (nextRainfallIntensity !== state.rainfallIntensity && !gameEnded) {
    newState = addAction(newState, 'rainfall_change', {
      rainfallIntensity: nextRainfallIntensity,
    });
  }

  return {
    newState,
    newLeaks,
    roundEnded: true,
    gameEnded,
  };
};

export const togglePause = (state: GameState): GameState => {
  if (state.phase !== 'playing') return state;
  return {
    ...state,
    isPaused: !state.isPaused,
  };
};

export const restartGame = (levelConfig: LevelConfig): GameState => {
  return createInitialState(levelConfig);
};

export const getFailureAnalysis = (state: GameState): string[] => {
  if (!state.failed) return [];
  
  const analysis: string[] = [];
  const blockedDrains = state.roofMap.drains.filter((d) => d.isBlocked);
  const uninspectedDrains = state.roofMap.drains.filter((d) => !d.inspected);
  const floodedAreas = state.roofMap.lowAreas.filter((l) => l.waterLevel >= GAME_CONSTANTS.LEAK_THRESHOLD);

  if (blockedDrains.length > 0) {
    analysis.push(`有 ${blockedDrains.length} 个排水口仍处于堵塞状态`);
  }
  if (uninspectedDrains.length > 0) {
    analysis.push(`漏查了 ${uninspectedDrains.length} 个排水口`);
  }
  if (floodedAreas.length > 0) {
    analysis.push(`有 ${floodedAreas.length} 个低洼区积水溢出`);
  }
  if (state.resolvedIssues.length === 0) {
    analysis.push('未处置任何隐患');
  }

  return analysis;
};
