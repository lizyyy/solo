import { create } from 'zustand';
import type {
  GamePhase,
  Level,
  Position,
  GameEvent,
  CardType,
  Guard,
  GameRecord,
} from '../game/types';
import {
  checkHumidityRisk,
  checkDoorPermission,
} from '../game/riskSystem';
import { calculateScore } from '../game/scoring';
import { saveRecord } from '../game/replay';
import { isAdjacent } from '../game/map';

interface GameState {
  phase: GamePhase;
  currentLevel: Level | null;
  currentRound: number;
  playerPosition: Position | null;
  plannedPath: Position[];
  executedPath: Position[];
  events: GameEvent[];
  availableCards: CardType[];
  desiccantCount: number;
  score: number;
  guards: Guard[];
  failReason: string | null;
  isDesiccantActive: boolean;
  showResult: boolean;
  savedRecord: GameRecord | null;

  setLevel: (level: Level) => void;
  planPath: (path: Position[]) => void;
  addToPath: (position: Position) => void;
  undoPath: () => void;
  clearPath: () => void;
  startExecution: () => void;
  executeStep: () => { finished: boolean; success: boolean };
  pause: () => void;
  resume: () => void;
  restart: () => void;
  useDesiccant: () => void;
  finishGame: (success: boolean, failReason?: string) => void;
  addEvent: (event: GameEvent) => void;
  setShowResult: (show: boolean) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'planning',
  currentLevel: null,
  currentRound: 0,
  playerPosition: null,
  plannedPath: [],
  executedPath: [],
  events: [],
  availableCards: [],
  desiccantCount: 0,
  score: 0,
  guards: [],
  failReason: null,
  isDesiccantActive: false,
  showResult: false,
  savedRecord: null,

  setLevel: (level: Level) => {
    set({
      currentLevel: level,
      phase: 'planning',
      currentRound: 0,
      playerPosition: level.exhibit.startPosition,
      plannedPath: [],
      executedPath: [],
      events: [],
      availableCards: [...level.availableCards],
      desiccantCount: level.desiccantCount,
      score: 0,
      guards: level.guards.map((g) => ({ ...g })),
      failReason: null,
      isDesiccantActive: false,
      showResult: false,
      savedRecord: null,
    });
  },

  planPath: (path: Position[]) => {
    set({ plannedPath: path });
  },

  addToPath: (position: Position) => {
    const { plannedPath, currentLevel, events, playerPosition } = get();
    if (!currentLevel) return;

    const newEvents: GameEvent[] = [...events];
    const lastPos = plannedPath.length > 0
      ? plannedPath[plannedPath.length - 1]
      : playerPosition;

    let isWrongOperation = false;
    let errorMsg = '';

    if (position.x < 0 || position.x >= currentLevel.gridSize.width ||
        position.y < 0 || position.y >= currentLevel.gridSize.height) {
      isWrongOperation = true;
      errorMsg = '点击位置超出地图边界';
    } else if (currentLevel.map[position.y]?.[position.x] === 'wall') {
      isWrongOperation = true;
      errorMsg = '无法穿越墙壁';
    } else if (lastPos && !isAdjacent(lastPos, position)) {
      if (plannedPath.length === 0 && playerPosition &&
          position.x === playerPosition.x && position.y === playerPosition.y) {
        // 点击起点，允许
      } else {
        isWrongOperation = true;
        errorMsg = '只能点击相邻格子';
      }
    } else if (plannedPath.some(p => p.x === position.x && p.y === position.y)) {
      isWrongOperation = true;
      errorMsg = '路径不能重复经过同一位置';
    }

    if (isWrongOperation) {
      newEvents.push({
        round: 0,
        type: 'wrong_operation',
        position,
        description: `操作错误：${errorMsg}`,
        scoreChange: -100,
      });
      set({
        events: newEvents,
        score: newEvents.reduce((sum, e) => sum + e.scoreChange, 0),
      });
      return;
    }

    if (plannedPath.length === 0 && playerPosition) {
      if (position.x === playerPosition.x && position.y === playerPosition.y) {
        set({ plannedPath: [position] });
      } else {
        set({ plannedPath: [playerPosition, position] });
      }
    } else {
      set({ plannedPath: [...plannedPath, position] });
    }
  },

  undoPath: () => {
    const { plannedPath } = get();
    if (plannedPath.length > 0) {
      set({ plannedPath: plannedPath.slice(0, -1) });
    }
  },

  clearPath: () => {
    set({ plannedPath: [] });
  },

  startExecution: () => {
    const { plannedPath, playerPosition } = get();
    if (plannedPath.length === 0 || !playerPosition) return;

    set({
      phase: 'executing',
      currentRound: 0,
      executedPath: [playerPosition],
    });
  },

  executeStep: () => {
    const state = get();
    const { plannedPath, executedPath, currentLevel, currentRound, guards,
            availableCards, isDesiccantActive, events } = state;

    if (!currentLevel) return { finished: false, success: false };

    const nextIndex = executedPath.length;

    if (nextIndex >= plannedPath.length) {
      return { finished: true, success: true };
    }

    const nextPosition = plannedPath[nextIndex];
    const newRound = currentRound + 1;

    const updatedGuards = guards.map((guard) => {
      if (guard.patrolPath.length <= 1) return guard;

      const nextPatrolIndex =
        (guard.currentPathIndex + 1) % guard.patrolPath.length;
      return {
        ...guard,
        currentPathIndex: nextPatrolIndex,
        position: guard.patrolPath[nextPatrolIndex],
      };
    });

    const newEvents: GameEvent[] = [...events];
    let failReason: string | null = null;
    let gameFailed = false;

    const doorAtPos = currentLevel.doors.find(
      (d) => d.position.x === nextPosition.x && d.position.y === nextPosition.y
    );
    if (doorAtPos) {
      const perm = checkDoorPermission(doorAtPos, availableCards);
      if (!perm.allowed) {
        newEvents.push({
          round: newRound,
          type: 'door_permission_denied',
          position: nextPosition,
          description: `未授权开门！需要 ${perm.missingCard} 卡`,
          scoreChange: -300,
        });
        newEvents.push({
          round: newRound,
          type: 'alert',
          position: nextPosition,
          description: '警报触发！未授权访问',
          scoreChange: 0,
        });
        failReason = '未授权开门触发警报';
        gameFailed = true;
      } else {
        newEvents.push({
          round: newRound,
          type: 'door_open',
          position: nextPosition,
          description: `使用 ${doorAtPos.requiredCard} 卡开门`,
          scoreChange: 0,
        });
      }
    }

    if (!gameFailed) {
      for (const guard of updatedGuards) {
        const dist = Math.abs(guard.position.x - nextPosition.x) +
                     Math.abs(guard.position.y - nextPosition.y);
        if (dist <= guard.visionRange) {
          newEvents.push({
            round: newRound,
            type: 'guard_spotted',
            position: nextPosition,
            description: `被安保人员发现！`,
            scoreChange: -500,
          });
          failReason = '被安保人员发现';
          gameFailed = true;
          break;
        }
      }
    }

    if (!gameFailed) {
      const congested = currentLevel.congestionZones.some(
        (z) => z.activeRounds.includes(newRound) &&
               z.position.x === nextPosition.x &&
               z.position.y === nextPosition.y
      );
      if (congested) {
        newEvents.push({
          round: newRound,
          type: 'congestion',
          position: nextPosition,
          description: '通道拥堵，展品被困！任务失败',
          scoreChange: -50,
        });
        failReason = '通道拥堵导致展品被困';
        gameFailed = true;
      }
    }

    if (!gameFailed && !isDesiccantActive) {
      const humidityRisk = checkHumidityRisk(currentLevel, nextPosition, newRound);
      if (humidityRisk.risk && humidityRisk.humidity > currentLevel.exhibit.maxHumidity) {
        newEvents.push({
          round: newRound,
          type: 'humidity_damage',
          position: nextPosition,
          description: `湿度过高！当前 ${humidityRisk.humidity}%，展品受损`,
          scoreChange: -100,
        });
      }
    }

    if (!gameFailed && newRound > currentLevel.maxRounds) {
      newEvents.push({
        round: newRound,
        type: 'timeout',
        position: nextPosition,
        description: `超时！已超过最大回合数 ${currentLevel.maxRounds}`,
        scoreChange: -200,
      });
      failReason = '护送超时';
      gameFailed = true;
    }

    const isFinished = nextIndex + 1 >= plannedPath.length;
    const success = !gameFailed && isFinished;

    set({
      playerPosition: nextPosition,
      executedPath: [...executedPath, nextPosition],
      currentRound: newRound,
      guards: updatedGuards,
      isDesiccantActive: false,
      events: newEvents,
      score: newEvents.reduce((sum, e) => sum + e.scoreChange, 0),
    });

    if (success || gameFailed) {
      const finalEvents = [...newEvents];
      if (success) {
        finalEvents.push({
          round: newRound,
          type: 'success',
          position: nextPosition,
          description: '展品成功护送入库！',
          scoreChange: 0,
        });
      }

      const scoreResult = calculateScore(finalEvents, currentLevel.maxRounds, newRound);
      const record: GameRecord = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        levelId: currentLevel.id.toString(),
        totalScore: scoreResult.totalScore,
        rating: scoreResult.rating,
        success,
        failReason: gameFailed ? (failReason || undefined) : undefined,
        events: finalEvents,
        path: [...executedPath, nextPosition],
        totalRounds: newRound,
      };

      saveRecord(record);

      set({
        phase: success ? 'completed' : 'failed',
        failReason: gameFailed ? (failReason || null) : null,
        showResult: true,
        events: finalEvents,
        score: scoreResult.totalScore,
        savedRecord: record,
      });
    }

    return { finished: isFinished || gameFailed, success };
  },

  pause: () => {
    const { phase } = get();
    if (phase === 'executing') {
      set({ phase: 'paused' });
    }
  },

  resume: () => {
    const { phase } = get();
    if (phase === 'paused') {
      set({ phase: 'executing' });
    }
  },

  restart: () => {
    const { currentLevel } = get();
    if (currentLevel) {
      get().setLevel(currentLevel);
    }
  },

  useDesiccant: () => {
    const { desiccantCount, phase, playerPosition, currentLevel, events, currentRound } = get();
    if (desiccantCount > 0 && phase === 'executing' && playerPosition && currentLevel) {
      const newEvents: GameEvent[] = [...events];

      const currentHumidity = currentLevel.humidityZones.reduce((max, z) => {
        const dist = Math.abs(z.position.x - playerPosition.x) +
                     Math.abs(z.position.y - playerPosition.y);
        if (dist <= z.radius) {
          return Math.max(max, z.humidity);
        }
        return max;
      }, 0);

      const isWaste = currentHumidity < 50;

      if (isWaste) {
        newEvents.push({
          round: currentRound,
          type: 'resource_waste',
          position: playerPosition,
          description: `干燥剂使用不当！当前湿度仅 ${currentHumidity}%，浪费资源`,
          scoreChange: -150,
        });
      }

      newEvents.push({
        round: currentRound,
        type: 'item_used',
        position: playerPosition,
        description: isWaste ? '使用干燥剂（资源浪费）' : '使用干燥剂抵御湿度',
        scoreChange: 0,
      });

      set({
        desiccantCount: desiccantCount - 1,
        isDesiccantActive: true,
        events: newEvents,
        score: newEvents.reduce((sum, e) => sum + e.scoreChange, 0),
      });
    }
  },

  finishGame: (success: boolean, failReason?: string) => {
    set({
      phase: success ? 'completed' : 'failed',
      failReason: success ? null : failReason ?? null,
      showResult: true,
    });
  },

  setShowResult: (show: boolean) => {
    set({ showResult: show });
  },

  addEvent: (event: GameEvent) => {
    const { events, score } = get();
    set({
      events: [...events, event],
      score: score + event.scoreChange,
    });
  },
}));
