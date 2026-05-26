import { create } from 'zustand';
import {
  GameState,
  GameActions,
  Level,
  InventoryItem,
  TeamState,
  ScoreBreakdown,
  ActiveEvent,
  HistoryStep,
  ReplayData,
} from './types';
import { getRandomEvent } from '../data/events';

const initialScore: ScoreBreakdown = {
  total: 0,
  baseScore: 0,
  timeBonus: 0,
  healthBonus: 0,
  inventoryBonus: 0,
  noExpiredBonus: 0,
  supplyVisitedBonus: 0,
  eventChoicesBonus: 0,
  penalties: [],
};

const initialTeamState: TeamState = {
  health: 100,
  maxHealth: 100,
  actionPoints: 3,
  maxActionPoints: 3,
};

const initialState: GameState = {
  status: 'menu',
  currentLevel: null,
  turn: 1,
  maxTurns: 0,
  team: { ...initialTeamState },
  inventory: [],
  currentNode: '',
  visitedNodes: [],
  activeEvent: null,
  history: [],
  score: { ...initialScore },
  isWin: false,
  failReason: null,
  gameStartTime: 0,
  replayData: null,
  replayStepIndex: 0,
};

const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  ...initialState,

  startGame: (level: Level) => {
    const startNode = level.nodes.find(n => n.id === level.startNode);
    set({
      status: 'playing',
      currentLevel: level,
      turn: 1,
      maxTurns: level.maxTurns,
      team: { ...initialTeamState },
      inventory: deepClone(level.startInventory),
      currentNode: level.startNode,
      visitedNodes: [level.startNode],
      activeEvent: null,
      history: [],
      score: { ...initialScore, baseScore: 100 },
      isWin: false,
      failReason: null,
      gameStartTime: Date.now(),
      replayData: null,
      replayStepIndex: 0,
    });
  },

  pauseGame: () => {
    if (get().status === 'playing') {
      set({ status: 'paused' });
    }
  },

  resumeGame: () => {
    if (get().status === 'paused') {
      set({ status: 'playing' });
    }
  },

  restartGame: () => {
    const { currentLevel } = get();
    if (currentLevel) {
      get().startGame(currentLevel);
    }
  },

  endGame: () => {
    set({ status: 'settlement' });
  },

  moveToNode: (nodeId: string) => {
    const state = get();
    if (state.status !== 'playing' || !state.currentLevel) return;
    if (state.team.actionPoints < 1) return;
    if (state.activeEvent) return;

    const currentNodeData = state.currentLevel.nodes.find(n => n.id === state.currentNode);
    if (!currentNodeData?.connections.includes(nodeId)) return;

    const targetNode = state.currentLevel.nodes.find(n => n.id === nodeId);
    if (!targetNode) return;

    const newInventory = state.inventory.map(item => {
      if (item.expiryTurn !== undefined && item.expiryTurn <= state.turn + 1) {
        return { ...item, isExpired: true };
      }
      return item;
    });

    const newHistory: HistoryStep = {
      turn: state.turn,
      action: 'move',
      nodeId,
      inventorySnapshot: deepClone(newInventory),
      teamState: {
        ...state.team,
        actionPoints: state.team.actionPoints - 1,
      },
      scoreSnapshot: state.score.total,
      timestamp: Date.now(),
    };

    const newVisitedNodes = state.visitedNodes.includes(nodeId)
      ? state.visitedNodes
      : [...state.visitedNodes, nodeId];

    set({
      currentNode: nodeId,
      visitedNodes: newVisitedNodes,
      inventory: newInventory,
      team: {
        ...state.team,
        actionPoints: state.team.actionPoints - 1,
      },
      history: [...state.history, newHistory],
    });

    if (targetNode.type === 'end') {
      setTimeout(() => get().checkWinCondition(), 100);
      return;
    }

    if (Math.random() < state.currentLevel.eventChance) {
      const event = getRandomEvent(state.currentLevel.eventPool);
      if (event) {
        const activeEvent: ActiveEvent = {
          ...event,
          triggeredAt: state.turn,
        };
        set({ activeEvent });
      }
    }
  },

  checkWinCondition: () => {
    const state = get();
    if (!state.currentLevel) return;

    const hasExpiredItems = state.inventory.some(item => item.isExpired);
    const totalWeight = state.inventory.reduce((sum, item) => sum + item.weight * item.quantity, 0);
    const isOverweight = totalWeight > state.currentLevel.maxWeight;
    const missedCriticalNodes = state.currentLevel.criticalSupplyNodes?.filter(
      nodeId => !state.visitedNodes.includes(nodeId)
    ) || [];

    let failReason: string | null = null;

    if (state.team.health <= 0) {
      failReason = '队伍生命值归零';
    } else if (hasExpiredItems) {
      failReason = '急救包中存在过期药品';
    } else if (isOverweight) {
      failReason = '急救包超重';
    } else if (missedCriticalNodes.length > 0) {
      failReason = '错过关键补给点';
    }

    if (failReason) {
      const finalScore = get().calculateFinalScore();
      set({
        status: 'settlement',
        isWin: false,
        failReason,
        score: finalScore,
      });
      get().saveReplayData();
    } else {
      const finalScore = get().calculateFinalScore();
      set({
        status: 'settlement',
        isWin: true,
        score: finalScore,
      });
      get().saveReplayData();
    }
  },

  calculateFinalScore: (): ScoreBreakdown => {
    const state = get();
    if (!state.currentLevel) return state.score;

    const totalWeight = state.inventory.reduce((sum, item) => sum + item.weight * item.quantity, 0);
    const weightRatio = 1 - totalWeight / state.currentLevel.maxWeight;
    const healthRatio = state.team.health / state.team.maxHealth;
    const turnsUsed = state.turn;
    const supplyVisited = state.visitedNodes.filter(
      id => state.currentLevel?.nodes.find(n => n.id === id)?.type === 'supply'
    ).length;
    const totalSupply = state.currentLevel.nodes.filter(n => n.type === 'supply').length;

    const timeBonus = Math.max(0, (state.maxTurns - turnsUsed) * 10);
    const healthBonus = Math.floor(healthRatio * 50);
    const inventoryBonus = Math.floor(weightRatio * 30);
    const noExpiredBonus = state.inventory.every(item => !item.isExpired) ? 50 : 0;
    const supplyVisitedBonus = Math.floor((supplyVisited / totalSupply) * 40);

    const total =
      state.score.baseScore +
      timeBonus +
      healthBonus +
      inventoryBonus +
      noExpiredBonus +
      supplyVisitedBonus +
      state.score.eventChoicesBonus -
      state.score.penalties.reduce((sum, p) => sum + p.amount, 0);

    return {
      ...state.score,
      total: Math.max(0, total),
      timeBonus,
      healthBonus,
      inventoryBonus,
      noExpiredBonus,
      supplyVisitedBonus,
    };
  },

  saveReplayData: () => {
    const state = get();
    if (!state.currentLevel) return;

    const replayData: ReplayData = {
      version: '1.0',
      levelId: state.currentLevel.id,
      levelName: state.currentLevel.name,
      timestamp: Date.now(),
      duration: Date.now() - state.gameStartTime,
      finalScore: state.score,
      isWin: state.isWin,
      failReason: state.failReason || undefined,
      steps: state.history,
    };

    const savedReplays = JSON.parse(localStorage.getItem('firstAidReplays') || '[]');
    savedReplays.unshift(replayData);
    localStorage.setItem('firstAidReplays', JSON.stringify(savedReplays.slice(0, 20)));

    set({ replayData });
  },

  canUseEventChoice: (choiceIndex: number): { canUse: boolean; missingItems: string[] } => {
    const state = get();
    if (!state.activeEvent) return { canUse: false, missingItems: [] };

    const choice = state.activeEvent.choices[choiceIndex];
    if (!choice) return { canUse: false, missingItems: [] };

    const missingItems: string[] = [];
    if (choice.effect.removeItems) {
      choice.effect.removeItems.forEach(itemId => {
        const item = state.inventory.find(i => i.id === itemId && i.quantity > 0 && !i.isExpired);
        if (!item) {
          const itemDef = state.currentLevel?.startInventory.find(i => i.id === itemId);
          missingItems.push(itemDef?.name || itemId);
        }
      });
    }

    return { canUse: missingItems.length === 0, missingItems };
  },

  handleEventChoice: (choiceIndex: number) => {
    const state = get();
    if (!state.activeEvent) return;

    const choice = state.activeEvent.choices[choiceIndex];
    if (!choice) return;

    const { canUse } = get().canUseEventChoice(choiceIndex);
    if (!canUse) return;

    let newHealth = state.team.health;
    let newActionPoints = state.team.actionPoints;
    let newInventory = [...state.inventory];
    let eventBonus = 0;

    if (choice.effect.health !== undefined) {
      newHealth = Math.max(0, Math.min(state.team.maxHealth, newHealth + choice.effect.health));
    }
    if (choice.effect.actionPoints !== undefined) {
      newActionPoints = Math.max(0, Math.min(state.team.maxActionPoints, newActionPoints + choice.effect.actionPoints));
    }
    if (choice.effect.score !== undefined) {
      eventBonus = choice.effect.score;
    }
    if (choice.effect.removeItems) {
      choice.effect.removeItems.forEach(itemId => {
        const idx = newInventory.findIndex(i => i.id === itemId && i.quantity > 0 && !i.isExpired);
        if (idx >= 0) {
          newInventory[idx] = {
            ...newInventory[idx],
            quantity: Math.max(0, newInventory[idx].quantity - 1),
          };
        }
      });
      newInventory = newInventory.filter(i => i.quantity > 0);
    }
    if (choice.effect.addItems) {
      choice.effect.addItems.forEach(newItem => {
        const existingIdx = newInventory.findIndex(i => i.id === newItem.id);
        if (existingIdx >= 0) {
          newInventory[existingIdx] = {
            ...newInventory[existingIdx],
            quantity: newInventory[existingIdx].quantity + newItem.quantity,
          };
        } else {
          newInventory.push({ ...newItem });
        }
      });
    }

    const newHistory: HistoryStep = {
      turn: state.turn,
      action: 'event',
      eventId: state.activeEvent.id,
      choiceIndex,
      inventorySnapshot: deepClone(newInventory),
      teamState: {
        ...state.team,
        health: newHealth,
        actionPoints: newActionPoints,
      },
      scoreSnapshot: state.score.total + eventBonus,
      timestamp: Date.now(),
    };

    set({
      team: {
        ...state.team,
        health: newHealth,
        actionPoints: newActionPoints,
      },
      inventory: newInventory,
      activeEvent: null,
      score: {
        ...state.score,
        eventChoicesBonus: state.score.eventChoicesBonus + eventBonus,
        total: state.score.total + eventBonus,
      },
      history: [...state.history, newHistory],
    });

    if (newHealth <= 0) {
      setTimeout(() => {
        const finalScore = get().calculateFinalScore();
        set({
          status: 'settlement',
          isWin: false,
          failReason: '队伍生命值归零',
          score: finalScore,
        });
        get().saveReplayData();
      }, 100);
    }
  },

  discardItem: (itemId: string, quantity: number) => {
    const state = get();
    const newInventory = state.inventory.map(item => {
      if (item.id === itemId) {
        return { ...item, quantity: Math.max(0, item.quantity - quantity) };
      }
      return item;
    }).filter(item => item.quantity > 0);

    const newHistory: HistoryStep = {
      turn: state.turn,
      action: 'inventory',
      inventorySnapshot: deepClone(newInventory),
      teamState: { ...state.team },
      scoreSnapshot: state.score.total,
      timestamp: Date.now(),
    };

    set({
      inventory: newInventory,
      history: [...state.history, newHistory],
    });
  },

  supplyItem: (itemId: string) => {
    const state = get();
    if (!state.currentLevel) return;

    const currentNode = state.currentLevel.nodes.find(n => n.id === state.currentNode);
    if (currentNode?.type !== 'supply' || !currentNode.supplyItems) return;

    const supplyItem = currentNode.supplyItems.find(i => i.id === itemId);
    if (!supplyItem) return;

    const newInventory = [...state.inventory];
    const existingIdx = newInventory.findIndex(i => i.id === supplyItem.id);
    if (existingIdx >= 0) {
      newInventory[existingIdx] = {
        ...newInventory[existingIdx],
        quantity: newInventory[existingIdx].quantity + 1,
        expiryTurn: supplyItem.expiryTurn ? state.turn + supplyItem.expiryTurn : undefined,
        isExpired: false,
      };
    } else {
      newInventory.push({
        ...supplyItem,
        quantity: 1,
        expiryTurn: supplyItem.expiryTurn ? state.turn + supplyItem.expiryTurn : undefined,
      });
    }

    const newHistory: HistoryStep = {
      turn: state.turn,
      action: 'supply',
      nodeId: state.currentNode,
      inventorySnapshot: deepClone(newInventory),
      teamState: { ...state.team },
      scoreSnapshot: state.score.total,
      timestamp: Date.now(),
    };

    set({
      inventory: newInventory,
      history: [...state.history, newHistory],
    });
  },

  endTurn: () => {
    const state = get();
    if (state.status !== 'playing' || state.activeEvent) return;

    const newTurn = state.turn + 1;

    if (newTurn > state.maxTurns) {
      const finalScore = get().calculateFinalScore();
      set({
        status: 'settlement',
        isWin: false,
        failReason: '超时未到达终点',
        score: finalScore,
      });
      get().saveReplayData();
      return;
    }

    const newInventory = state.inventory.map(item => {
      if (item.expiryTurn !== undefined && item.expiryTurn <= newTurn) {
        return { ...item, isExpired: true };
      }
      return item;
    });

    set({
      turn: newTurn,
      inventory: newInventory,
      team: {
        ...state.team,
        actionPoints: state.team.maxActionPoints,
      },
    });
  },

  goToMenu: () => {
    set({ ...initialState });
  },

  goToLevelSelect: () => {
    set({ status: 'levelSelect' });
  },

  startReplay: (replayData: ReplayData) => {
    set({
      status: 'replay',
      replayData,
      replayStepIndex: 0,
    });
  },

  replayNextStep: () => {
    const state = get();
    if (!state.replayData) return;
    if (state.replayStepIndex >= state.replayData.steps.length - 1) return;
    set({ replayStepIndex: state.replayStepIndex + 1 });
  },

  replayPrevStep: () => {
    const state = get();
    if (state.replayStepIndex <= 0) return;
    set({ replayStepIndex: state.replayStepIndex - 1 });
  },

  replayGoToStep: (index: number) => {
    const state = get();
    if (!state.replayData) return;
    const clampedIndex = Math.max(0, Math.min(state.replayData.steps.length - 1, index));
    set({ replayStepIndex: clampedIndex });
  },

  exportReport: (): string => {
    const state = get();
    const report = {
      gameName: '急救包补给游戏',
      timestamp: new Date().toISOString(),
      level: state.currentLevel?.name || '未知',
      difficulty: state.currentLevel?.difficulty || 'unknown',
      isWin: state.isWin,
      failReason: state.failReason,
      turnsUsed: state.turn,
      maxTurns: state.maxTurns,
      finalScore: state.score,
      team: state.team,
      inventory: state.inventory,
      visitedNodes: state.visitedNodes.map(id => {
        const node = state.currentLevel?.nodes.find(n => n.id === id);
        return node?.name || id;
      }),
      historySummary: state.history.map(step => ({
        turn: step.turn,
        action: step.action,
        nodeName: step.nodeId
          ? state.currentLevel?.nodes.find(n => n.id === step.nodeId)?.name
          : undefined,
        score: step.scoreSnapshot,
      })),
    };
    return JSON.stringify(report, null, 2);
  },
}));
