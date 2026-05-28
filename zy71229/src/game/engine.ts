import {
  GameState,
  Position,
  RouteNode,
  Anomaly,
  AnomalyStatus,
  Decision,
  DataSource,
  ScoreItem,
  GameStateSnapshot,
  AnomalyType,
} from './types';
import { GAME_CONFIG, SCORE_CONFIG } from './config';
import { generateAnomalies } from './generator';
import { MOCK_HALLS, MOCK_CORNERS, START_POSITION } from '../mock/halls';
import { MOCK_ARTWORKS } from '../mock/artworks';
import { MOCK_DOORS } from '../mock/doors';
import { MOCK_LIGHTS } from '../mock/lights';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function createInitialState(): GameState {
  const halls = JSON.parse(JSON.stringify(MOCK_HALLS));
  const corners = JSON.parse(JSON.stringify(MOCK_CORNERS));
  const artworks = JSON.parse(JSON.stringify(MOCK_ARTWORKS));
  const doors = JSON.parse(JSON.stringify(MOCK_DOORS));
  const lights = JSON.parse(JSON.stringify(MOCK_LIGHTS));

  const anomalies = generateAnomalies(halls, corners, artworks, doors, lights);

  return {
    id: generateId(),
    startTime: Date.now(),
    endTime: null,
    gameTime: 0,
    totalTime: GAME_CONFIG.TOTAL_TIME,
    timeScale: GAME_CONFIG.DEFAULT_TIME_SCALE,
    isPaused: true,
    isGameOver: false,
    currentPosition: { ...START_POSITION },
    currentHallId: null,
    plannedRoute: [],
    isMoving: false,
    moveTarget: null,
    moveStartTime: 0,
    moveDuration: 0,
    halls,
    corners,
    artworks,
    doors,
    lights,
    anomalies,
    decisions: [],
    score: [],
    totalScore: 0,
    viewedDataSources: {
      [DataSource.HALL]: [],
      [DataSource.ART]: [],
      [DataSource.DOOR]: [],
      [DataSource.LIGHT]: [],
      [DataSource.ROUTE]: [],
      [DataSource.REPORT]: [],
    },
    reportDraft: '',
    activeAnomalyId: null,
  };
}

export function calculateDistance(p1: Position, p2: Position): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

export function calculateMoveTime(from: Position, to: Position): number {
  const distance = calculateDistance(from, to);
  return Math.ceil(distance / GAME_CONFIG.MOVE_SPEED);
}

export function createRouteNode(
  hallId: string,
  position: Position,
  type: RouteNode['type'],
  targetId: string,
  currentPosition: Position
): RouteNode {
  return {
    id: generateId(),
    hallId,
    position: { ...position },
    type,
    targetId,
    estimatedTime: calculateMoveTime(currentPosition, position),
  };
}

export function createSnapshot(
  state: GameState,
  eventType: GameStateSnapshot['eventType']
): GameStateSnapshot {
  return {
    timestamp: state.gameTime,
    gameState: {
      gameTime: state.gameTime,
      currentPosition: { ...state.currentPosition },
      currentHallId: state.currentHallId,
      isMoving: state.isMoving,
      halls: JSON.parse(JSON.stringify(state.halls)),
      corners: JSON.parse(JSON.stringify(state.corners)),
      anomalies: JSON.parse(JSON.stringify(state.anomalies)),
      decisions: JSON.parse(JSON.stringify(state.decisions)),
    },
    eventType,
  };
}

export function getPositionAtTime(
  from: Position,
  to: Position,
  startTime: number,
  duration: number,
  currentTime: number
): Position {
  if (duration <= 0) return to;
  
  const elapsed = currentTime - startTime;
  const progress = Math.min(1, Math.max(0, elapsed / duration));
  
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

export function isNearPosition(p1: Position, p2: Position, radius: number = GAME_CONFIG.CORNER_CHECK_RADIUS): boolean {
  return calculateDistance(p1, p2) <= radius;
}

export function getHallAtPosition(position: Position, halls: GameState['halls']): string | null {
  for (const hall of halls) {
    if (
      position.x >= hall.position.x &&
      position.x <= hall.position.x + hall.position.width &&
      position.y >= hall.position.y &&
      position.y <= hall.position.y + hall.position.height
    ) {
      return hall.id;
    }
  }
  return null;
}

export function markPatrolled(state: GameState, position: Position): Partial<GameState> {
  const updates: Partial<GameState> = {};
  let hasChanges = false;

  const newCorners = state.corners.map(corner => {
    if (!corner.isPatrolled && isNearPosition(position, corner.position)) {
      hasChanges = true;
      return { ...corner, isPatrolled: true, patrolTime: state.gameTime };
    }
    return corner;
  });

  if (hasChanges) {
    updates.corners = newCorners;
  }

  const hallId = getHallAtPosition(position, state.halls);
  if (hallId) {
    const newHalls = state.halls.map(hall => {
      if (hall.id === hallId && !hall.isPatrolled) {
        const hallCorners = newCorners.filter(c => c.hallId === hallId);
        const allPatrolled = hallCorners.every(c => c.isPatrolled);
        if (allPatrolled) {
          hasChanges = true;
          return { ...hall, isPatrolled: true, patrolTime: state.gameTime };
        }
      }
      return hall;
    });

    if (hasChanges) {
      updates.halls = newHalls;
    }
    updates.currentHallId = hallId;
  }

  return updates;
}

export function triggerAnomalies(state: GameState): Partial<GameState> | null {
  const triggeredAnomalies = state.anomalies.filter(
    a => a.triggerTime <= state.gameTime && a.status === AnomalyStatus.PENDING && a.detectedTime === null
  );

  if (triggeredAnomalies.length === 0) return null;

  const newAnomalies = state.anomalies.map(a => {
    if (triggeredAnomalies.find(t => t.id === a.id)) {
      return { ...a, detectedTime: state.gameTime };
    }
    return a;
  });

  return { anomalies: newAnomalies };
}

export function processDecision(
  state: GameState,
  anomalyId: string,
  choice: AnomalyStatus,
  decisionStartTime: number
): { updates: Partial<GameState>; decision: Decision } {
  const anomaly = state.anomalies.find(a => a.id === anomalyId);
  if (!anomaly) {
    throw new Error('Anomaly not found');
  }

  const timeSpent = state.gameTime - decisionStartTime;

  const sourcesViewed = Object.entries(state.viewedDataSources)
    .filter(([_, timestamps]) => timestamps.some(t => t >= decisionStartTime - 30 && t <= state.gameTime))
    .map(([source]) => source as DataSource);

  const isCorrect = choice === anomaly.correctAction;

  const decision: Decision = {
    id: generateId(),
    timestamp: state.gameTime,
    realTimestamp: Date.now(),
    anomalyId,
    choice,
    evidenceUsed: sourcesViewed,
    timeSpent,
    isCorrect,
  };

  const newAnomalies = state.anomalies.map(a => {
    if (a.id === anomalyId) {
      return {
        ...a,
        status: choice,
        playerChoice: choice,
        resolvedTime: state.gameTime + GAME_CONFIG.DECISION_TIME_COST,
      };
    }
    return a;
  });

  const updates: Partial<GameState> = {
    anomalies: newAnomalies,
    decisions: [...state.decisions, decision],
    gameTime: state.gameTime + GAME_CONFIG.DECISION_TIME_COST,
    activeAnomalyId: null,
  };

  return { updates, decision };
}

export function checkGameOver(state: GameState): Partial<GameState> | null {
  if (state.gameTime >= state.totalTime) {
    return {
      isGameOver: true,
      endTime: Date.now(),
    };
  }

  const allResolved = state.anomalies.every(a => a.status !== AnomalyStatus.PENDING);
  if (allResolved && state.anomalies.length > 0) {
    return {
      isGameOver: true,
      endTime: Date.now(),
    };
  }

  return null;
}

export function calculateScore(state: GameState): ScoreItem[] {
  const scoreItems: ScoreItem[] = [];

  let accuracyPoints = 0;
  const resolvedDecisions = state.decisions.filter(d => {
    const anomaly = state.anomalies.find(a => a.id === d.anomalyId);
    return anomaly && anomaly.status !== AnomalyStatus.PENDING;
  });

  for (const decision of resolvedDecisions) {
    if (decision.isCorrect) {
      accuracyPoints += SCORE_CONFIG.ACCURACY.CORRECT_BONUS;
    } else {
      accuracyPoints -= SCORE_CONFIG.ACCURACY.WRONG_PENALTY;
    }
  }
  accuracyPoints = Math.max(0, Math.min(SCORE_CONFIG.ACCURACY.MAX, accuracyPoints));
  scoreItems.push({
    category: '异常处理准确率',
    description: `正确处理 +${SCORE_CONFIG.ACCURACY.CORRECT_BONUS}分，错误处理 -${SCORE_CONFIG.ACCURACY.WRONG_PENALTY}分`,
    points: accuracyPoints,
    maxPoints: SCORE_CONFIG.ACCURACY.MAX,
  });

  let coveragePoints = 0;
  const unpatrolledCorners = state.corners.filter(c => !c.isPatrolled);
  if (unpatrolledCorners.length === 0) {
    coveragePoints = SCORE_CONFIG.COVERAGE.FULL_COVERAGE_BONUS;
  } else {
    coveragePoints = Math.max(0, SCORE_CONFIG.COVERAGE.MAX - unpatrolledCorners.length * SCORE_CONFIG.COVERAGE.MISSED_CORNER_PENALTY);
  }
  scoreItems.push({
    category: '巡逻覆盖率',
    description: `全覆盖 +${SCORE_CONFIG.COVERAGE.FULL_COVERAGE_BONUS}分，每个漏巡角落 -${SCORE_CONFIG.COVERAGE.MISSED_CORNER_PENALTY}分`,
    points: coveragePoints,
    maxPoints: SCORE_CONFIG.COVERAGE.MAX,
  });

  let timelinessPoints: number = SCORE_CONFIG.TIMELINESS.MAX;
  for (const decision of resolvedDecisions) {
    const anomaly = state.anomalies.find(a => a.id === decision.anomalyId);
    if (anomaly && anomaly.triggerTime !== null) {
      const responseTime = decision.timestamp - anomaly.triggerTime;
      if (responseTime <= SCORE_CONFIG.TIMELINESS.FAST_THRESHOLD) {
        timelinessPoints = Math.min(SCORE_CONFIG.TIMELINESS.MAX, timelinessPoints + SCORE_CONFIG.TIMELINESS.FAST_BONUS);
      } else if (responseTime >= SCORE_CONFIG.TIMELINESS.SLOW_THRESHOLD) {
        timelinessPoints = Math.max(0, timelinessPoints - SCORE_CONFIG.TIMELINESS.SLOW_PENALTY);
      }
    }
  }
  scoreItems.push({
    category: '处理时效性',
    description: `${SCORE_CONFIG.TIMELINESS.FAST_THRESHOLD}秒内处理 +${SCORE_CONFIG.TIMELINESS.FAST_BONUS}分，超过${SCORE_CONFIG.TIMELINESS.SLOW_THRESHOLD}秒 -${SCORE_CONFIG.TIMELINESS.SLOW_PENALTY}分`,
    points: timelinessPoints,
    maxPoints: SCORE_CONFIG.TIMELINESS.MAX,
  });

  let falseAlarmPoints = 0;
  const falseAlarmAnomalies = state.anomalies.filter(a => !a.isTrueAnomaly && a.status !== AnomalyStatus.PENDING);
  for (const anomaly of falseAlarmAnomalies) {
    if (anomaly.playerChoice === AnomalyStatus.FALSE_ALARM) {
      falseAlarmPoints += SCORE_CONFIG.FALSE_ALARM.CORRECT_IDENTIFY_BONUS;
    }
  }

  const trueAnomaliesMarkedFalse = state.anomalies.filter(
    a => a.isTrueAnomaly && a.playerChoice === AnomalyStatus.FALSE_ALARM
  );
  falseAlarmPoints -= trueAnomaliesMarkedFalse.length * SCORE_CONFIG.FALSE_ALARM.WRONG_MISS_PENALTY;
  falseAlarmPoints = Math.max(0, Math.min(SCORE_CONFIG.FALSE_ALARM.MAX, falseAlarmPoints));
  scoreItems.push({
    category: '误报识别率',
    description: `正确识别假异常 +${SCORE_CONFIG.FALSE_ALARM.CORRECT_IDENTIFY_BONUS}分，将真异常标记为误报 -${SCORE_CONFIG.FALSE_ALARM.WRONG_MISS_PENALTY}分`,
    points: falseAlarmPoints,
    maxPoints: SCORE_CONFIG.FALSE_ALARM.MAX,
  });

  let crossValidationPoints: number = SCORE_CONFIG.CROSS_VALIDATION.MAX;
  for (const decision of resolvedDecisions) {
    if (decision.evidenceUsed.length >= SCORE_CONFIG.CROSS_VALIDATION.GOOD_THRESHOLD) {
      crossValidationPoints = Math.min(SCORE_CONFIG.CROSS_VALIDATION.MAX, crossValidationPoints + SCORE_CONFIG.CROSS_VALIDATION.GOOD_BONUS);
    } else if (decision.evidenceUsed.length <= SCORE_CONFIG.CROSS_VALIDATION.BAD_THRESHOLD) {
      crossValidationPoints = Math.max(0, crossValidationPoints - SCORE_CONFIG.CROSS_VALIDATION.BAD_PENALTY);
    }
  }
  scoreItems.push({
    category: '数据交叉验证',
    description: `决策前查看≥${SCORE_CONFIG.CROSS_VALIDATION.GOOD_THRESHOLD}个数据源 +${SCORE_CONFIG.CROSS_VALIDATION.GOOD_BONUS}分，仅查看${SCORE_CONFIG.CROSS_VALIDATION.BAD_THRESHOLD}个 -${SCORE_CONFIG.CROSS_VALIDATION.BAD_PENALTY}分`,
    points: crossValidationPoints,
    maxPoints: SCORE_CONFIG.CROSS_VALIDATION.MAX,
  });

  return scoreItems;
}

export function calculateTotalScore(scoreItems: ScoreItem[]): number {
  return scoreItems.reduce((sum, item) => sum + item.points, 0);
}

export function formatGameTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatVirtualTime(seconds: number): string {
  const startHour = 22;
  const totalMinutes = Math.floor(seconds * 0.8);
  const hours = (startHour + Math.floor(totalMinutes / 60)) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getAnomalyTypeName(type: AnomalyType): string {
  const names: Record<AnomalyType, string> = {
    [AnomalyType.MISSED_CORNER]: '漏巡角落',
    [AnomalyType.DOOR_FALSE_ALARM]: '门禁告警',
    [AnomalyType.ART_VIBRATION]: '作品震动',
    [AnomalyType.LIGHT_ABNORMAL]: '灯光异常',
  };
  return names[type];
}
