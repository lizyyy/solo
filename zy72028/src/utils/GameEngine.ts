import type {
  MaterialPackage,
  GameState,
  DecisionRecord,
  EventOption,
  Resources,
  GameEvent,
  FailureType
} from '../types';

export class GameEngine {
  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  static startGame(material: MaterialPackage): GameState {
    return {
      id: this.generateId(),
      materialId: material.id,
      materialName: material.name,
      startTime: new Date().toISOString(),
      status: 'playing',
      currentEventIndex: 0,
      resources: { ...material.initialResources },
      score: 100,
      decisions: [],
      totalTimeUsed: 0,
      gameDuration: material.gameDuration
    };
  }

  static processDecision(
    gameState: GameState,
    currentEvent: GameEvent,
    selectedOptionId: string,
    timeTaken: number
  ): { newState: GameState; feedback: string; isCorrect: boolean } {
    const option = currentEvent.options.find(o => o.id === selectedOptionId);
    if (!option) {
      throw new Error(`Option ${selectedOptionId} not found`);
    }

    const decision: DecisionRecord = {
      eventId: currentEvent.id,
      eventTitle: currentEvent.title,
      selectedOptionId: option.id,
      selectedOptionText: option.text,
      isCorrect: option.isCorrect,
      scoreChange: option.scoreChange,
      timeTaken,
      timestamp: new Date().toISOString(),
      ruleReference: option.ruleReference
    };

    const newResources = this.applyResourceCost(
      gameState.resources,
      option.resourceCost
    );

    const newScore = gameState.score + option.scoreChange;
    const newDecisions = [...gameState.decisions, decision];
    const newEventIndex = gameState.currentEventIndex + 1;
    const newTotalTimeUsed = gameState.totalTimeUsed + timeTaken;

    const newState: GameState = {
      ...gameState,
      currentEventIndex: newEventIndex,
      resources: newResources,
      score: newScore,
      decisions: newDecisions,
      totalTimeUsed: newTotalTimeUsed
    };

    return {
      newState,
      feedback: option.feedback,
      isCorrect: option.isCorrect
    };
  }

  private static applyResourceCost(
    resources: Resources,
    cost: Partial<Resources>
  ): Resources {
    return {
      buses: resources.buses - (cost.buses || 0),
      drivers: resources.drivers - (cost.drivers || 0),
      budget: resources.budget - (cost.budget || 0),
      reputation: resources.reputation - (cost.reputation || 0)
    };
  }

  static checkGameEnd(
    gameState: GameState,
    totalEvents: number,
    remainingTime: number
  ): { shouldEnd: boolean; failureType?: FailureType } {
    if (remainingTime <= 0) {
      return { shouldEnd: true, failureType: 'timeout' };
    }

    if (gameState.currentEventIndex >= totalEvents) {
      const incorrectCount = gameState.decisions.filter(d => !d.isCorrect).length;
      const totalCount = gameState.decisions.length;

      if (totalCount > 0 && incorrectCount / totalCount >= 0.5) {
        return { shouldEnd: true, failureType: 'rule_misunderstanding' };
      }

      return { shouldEnd: true };
    }

    if (gameState.resources.buses < 0 ||
        gameState.resources.drivers < 0 ||
        gameState.resources.budget < 0) {
      return { shouldEnd: true, failureType: 'rule_misunderstanding' };
    }

    return { shouldEnd: false };
  }

  static finalizeGame(
    gameState: GameState,
    failureType?: FailureType
  ): GameState {
    return {
      ...gameState,
      endTime: new Date().toISOString(),
      status: failureType ? 'failed' : 'completed',
      failureType
    };
  }

  static getScoreAnalysis(gameState: GameState): {
    totalScore: number;
    correctDecisions: number;
    incorrectDecisions: number;
    scoreBreakdown: { event: string; change: number; reason: string }[];
  } {
    const correctDecisions = gameState.decisions.filter(d => d.isCorrect).length;
    const incorrectDecisions = gameState.decisions.filter(d => !d.isCorrect).length;

    const scoreBreakdown = gameState.decisions.map(d => ({
      event: d.eventTitle,
      change: d.scoreChange,
      reason: d.ruleReference
    }));

    return {
      totalScore: gameState.score,
      correctDecisions,
      incorrectDecisions,
      scoreBreakdown
    };
  }

  static getFailureDescription(failureType: FailureType): {
    title: string;
    description: string;
    suggestions: string[];
  } {
    switch (failureType) {
      case 'timeout':
        return {
          title: '⏱️ 操作超时',
          description: '您未能在规定时间内完成所有调度决策。',
          suggestions: [
            '尝试更快地阅读事件描述',
            '提前熟悉公交调度规则',
            '练习快速决策能力'
          ]
        };
      case 'rule_misunderstanding':
        return {
          title: '📚 规则理解有误',
          description: '超过一半的调度决策不符合公交调度规则。',
          suggestions: [
            '重新学习公交调度基本原则',
            '注意每个事件的规则提示',
            '分析错误决策的扣分原因'
          ]
        };
      default:
        return {
          title: '游戏结束',
          description: '未知原因',
          suggestions: []
        };
    }
  }

  static getCriticalDecisions(gameState: GameState): DecisionRecord[] {
    return gameState.decisions.filter(d => !d.isCorrect || Math.abs(d.scoreChange) >= 10);
  }

  static pauseGame(gameState: GameState): GameState {
    return {
      ...gameState,
      pausedAt: new Date().toISOString()
    };
  }

  static resumeGame(gameState: GameState): GameState {
    if (!gameState.pausedAt) return gameState;

    const pausedMs = new Date(gameState.pausedAt).getTime();
    const nowMs = Date.now();
    const pauseDurationMs = nowMs - pausedMs;
    const newStartMs = new Date(gameState.startTime).getTime() + pauseDurationMs;

    const { pausedAt, ...rest } = gameState;
    return {
      ...rest,
      startTime: new Date(newStartMs).toISOString()
    };
  }

  static getRemainingSeconds(gameState: GameState): number {
    if (gameState.status !== 'playing') return 0;

    const startMs = new Date(gameState.startTime).getTime();
    const pausedMs = gameState.pausedAt ? new Date(gameState.pausedAt).getTime() : null;
    const nowMs = Date.now();

    const elapsedSec = Math.floor(
      ((pausedMs ?? nowMs) - startMs) / 1000
    ) - gameState.totalTimeUsed;

    return Math.max(gameState.gameDuration - elapsedSec, 0);
  }
}
