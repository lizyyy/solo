import type {
  Level,
  GameSession,
  GameStep,
  Resources,
  DecisionOption,
  ResourceEffect,
  ScoreResult,
  ScoreBreakdownItem,
  GameStatus,
} from '@/types';
import {
  generateId,
  applyResourceEffects,
  hasNegativeResources,
  getNegativeResourceNames,
  deepClone,
} from '@/utils/helpers';
import { LocalStorage } from '@/storage/LocalStorage';

export class GameEngine {
  private level: Level | null = null;
  private session: GameSession | null = null;

  constructor(level?: Level) {
    if (level) {
      this.level = level;
    }
  }

  setLevel(level: Level): void {
    this.level = level;
  }

  getLevel(): Level | null {
    return this.level;
  }

  getSession(): GameSession | null {
    return this.session;
  }

  startGame(levelId: string, playerName: string, existingSessionId?: string): GameSession {
    if (existingSessionId) {
      const existing = LocalStorage.getSession(existingSessionId);
      if (existing && existing.status !== 'completed') {
        this.session = existing;
        this.level = LocalStorage.getLevel(existing.levelId);
        return deepClone(this.session);
      }
    }

    const level = this.level || LocalStorage.getLevel(levelId);
    if (!level) {
      throw new Error(`Level with id ${levelId} not found`);
    }

    this.level = level;

    const startNode = level.nodes.find((n) => n.type === 'start');
    if (!startNode) {
      throw new Error('Level must have a start node');
    }

    let initialResources = { ...level.initialResources };
    
    if (startNode.effects) {
      initialResources = applyResourceEffects(initialResources, startNode.effects);
    }

    this.session = {
      id: generateId(),
      levelId: level.id,
      levelName: level.name,
      playerName,
      startTime: new Date().toISOString(),
      status: 'playing',
      currentNodeId: startNode.id,
      currentResources: initialResources,
      stepHistory: [],
      conflicts: [],
      hasNegativeResources: hasNegativeResources(initialResources),
    };

    if (this.session.hasNegativeResources) {
      this.session.status = 'interrupted';
      this.session.negativeResourceAt = new Date().toISOString();
    }

    LocalStorage.saveSession(this.session);
    return deepClone(this.session);
  }

  getAvailableDecisions(): DecisionOption[] {
    if (!this.session || !this.level) return [];

    const currentNodeId = this.session.currentNodeId;
    const availablePaths = this.level.paths.filter(
      (p) => p.from === currentNodeId
    );

    return availablePaths.flatMap((p) => p.decisions);
  }

  makeDecision(decisionId: string): GameSession {
    if (!this.session || !this.level) {
      throw new Error('Game not started');
    }

    if (this.session.status !== 'playing') {
      throw new Error(`Cannot make decision in status: ${this.session.status}`);
    }

    if (this.session.hasNegativeResources) {
      throw new Error('Cannot make decision with negative resources. Please supplement materials first.');
    }

    const currentNodeId = this.session.currentNodeId;
    const path = this.level.paths.find(
      (p) =>
        p.from === currentNodeId &&
        p.decisions.some((d) => d.id === decisionId)
    );

    if (!path) {
      throw new Error(`Decision ${decisionId} not available from current node`);
    }

    const decision = path.decisions.find((d) => d.id === decisionId);
    if (!decision) {
      throw new Error(`Decision ${decisionId} not found`);
    }

    const resourcesBefore = { ...this.session.currentResources };
    const resourcesAfter = applyResourceEffects(
      resourcesBefore,
      decision.resourceEffects
    );

    const nextNode = this.level.nodes.find((n) => n.id === path.to);
    let finalResources = resourcesAfter;
    
    if (nextNode?.effects) {
      finalResources = applyResourceEffects(finalResources, nextNode.effects);
    }

    const step: GameStep = {
      stepIndex: this.session.stepHistory.length,
      nodeId: path.to,
      decisionId: decision.id,
      decisionLabel: decision.label,
      resourcesBefore,
      resourcesAfter: finalResources,
      timestamp: new Date().toISOString(),
    };

    this.session.stepHistory.push(step);
    this.session.currentNodeId = path.to;
    this.session.currentResources = finalResources;
    this.session.hasNegativeResources = hasNegativeResources(finalResources);

    if (this.session.hasNegativeResources) {
      this.session.status = 'interrupted';
      this.session.negativeResourceAt = step.timestamp;
    }

    if (nextNode?.type === 'end') {
      this.endGame();
    }

    LocalStorage.saveSession(this.session);
    return deepClone(this.session);
  }

  supplementMaterials(effects: ResourceEffect[], reason: string): GameSession {
    if (!this.session || !this.level) {
      throw new Error('Game not started');
    }

    const resourcesBefore = { ...this.session.currentResources };
    const resourcesAfter = applyResourceEffects(resourcesBefore, effects);

    const step: GameStep = {
      stepIndex: this.session.stepHistory.length,
      nodeId: this.session.currentNodeId,
      resourcesBefore,
      resourcesAfter,
      timestamp: new Date().toISOString(),
      isSupplement: true,
      supplementReason: reason,
    };

    this.session.stepHistory.push(step);
    this.session.currentResources = resourcesAfter;
    this.session.hasNegativeResources = hasNegativeResources(resourcesAfter);

    if (!this.session.hasNegativeResources && this.session.status === 'interrupted') {
      this.session.status = 'playing';
      this.session.negativeResourceAt = undefined;
    }

    LocalStorage.saveSession(this.session);
    return deepClone(this.session);
  }

  pauseGame(): GameSession {
    if (!this.session) {
      throw new Error('Game not started');
    }

    if (this.session.status === 'playing') {
      this.session.status = 'paused';
      LocalStorage.saveSession(this.session);
    }

    return deepClone(this.session);
  }

  resumeGame(): GameSession {
    if (!this.session) {
      throw new Error('Game not started');
    }

    if (this.session.status === 'paused') {
      this.session.status = 'playing';
      LocalStorage.saveSession(this.session);
    }

    return deepClone(this.session);
  }

  restartGame(): GameSession {
    if (!this.session) {
      throw new Error('Game not started');
    }

    const levelId = this.session.levelId;
    const playerName = this.session.playerName;

    this.session = null;
    return this.startGame(levelId, playerName);
  }

  endGame(): GameSession {
    if (!this.session || !this.level) {
      throw new Error('Game not started');
    }

    const scoreResult = this.calculateScore();
    this.session.status = 'completed';
    this.session.endTime = new Date().toISOString();
    this.session.scoreResult = scoreResult;

    LocalStorage.saveSession(this.session);
    LocalStorage.setCurrentSessionId(null);

    return deepClone(this.session);
  }

  calculateScore(): ScoreResult {
    if (!this.session || !this.level) {
      throw new Error('Cannot calculate score without session and level');
    }

    const breakdown: ScoreBreakdownItem[] = [];
    const resources = this.session.currentResources;
    const targetConditions = this.level.targetConditions;

    breakdown.push({
      category: '完成度',
      maxScore: 30,
      earnedScore: this.session.status === 'completed' ? 30 : 0,
      description: this.session.status === 'completed'
        ? '成功到达终点'
        : '未能完成游戏',
    });

    let targetScore = 0;
    const targetMaxScore = 40;
    const perConditionScore = targetMaxScore / targetConditions.length;

    targetConditions.forEach((condition) => {
      const value = resources[condition.resource];
      let earned = 0;

      if (condition.exact !== undefined) {
        earned = Math.abs(value - condition.exact) <= 0.5 ? perConditionScore : 0;
      } else {
        const meetsMin = condition.min === undefined || value >= condition.min;
        const meetsMax = condition.max === undefined || value <= condition.max;
        if (meetsMin && meetsMax) {
          earned = perConditionScore;
        }
      }

      targetScore += earned;
    });

    breakdown.push({
      category: '目标达成',
      maxScore: targetMaxScore,
      earnedScore: Math.round(targetScore * 100) / 100,
      description: `达成 ${Math.round(targetScore / perConditionScore)} / ${targetConditions.length} 个目标条件`,
    });

    const steps = this.session.stepHistory.filter((s) => !s.isSupplement);
    const supplementCount = this.session.stepHistory.filter((s) => s.isSupplement).length;
    const efficiencyScore = Math.max(0, 20 - supplementCount * 5);

    breakdown.push({
      category: '决策效率',
      maxScore: 20,
      earnedScore: efficiencyScore,
      description: supplementCount === 0
        ? '无需补充材料，决策精准'
        : `使用了 ${supplementCount} 次补充材料`,
    });

    const hasNegative = this.session.hasNegativeResources;
    const resourceHealthScore = hasNegative ? 0 : 10;

    breakdown.push({
      category: '资源健康',
      maxScore: 10,
      earnedScore: resourceHealthScore,
      description: hasNegative
        ? `出现负数资源: ${getNegativeResourceNames(resources).join(', ')}`
        : '全程资源健康，无负数',
    });

    const totalScore = breakdown.reduce((sum, item) => sum + item.earnedScore, 0);
    const maxScore = breakdown.reduce((sum, item) => sum + item.maxScore, 0);

    return {
      totalScore: Math.round(totalScore * 100) / 100,
      maxScore,
      breakdown,
      teacherNotes: this.session.teacherNotes || '',
      calculatedAt: new Date().toISOString(),
    };
  }

  setTeacherNotes(notes: string): GameSession {
    if (!this.session) {
      throw new Error('Game not started');
    }

    this.session.teacherNotes = notes;
    
    if (this.session.scoreResult) {
      this.session.scoreResult.teacherNotes = notes;
    }

    LocalStorage.saveSession(this.session);
    return deepClone(this.session);
  }

  loadSession(sessionId: string): GameSession {
    const session = LocalStorage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.session = session;
    this.level = LocalStorage.getLevel(session.levelId);

    return deepClone(this.session);
  }

  getCurrentNode() {
    if (!this.session || !this.level) return null;
    return this.level.nodes.find((n) => n.id === this.session!.currentNodeId) || null;
  }

  getVisitedNodes(): string[] {
    if (!this.session || !this.level) return [];
    
    const startNode = this.level.nodes.find((n) => n.type === 'start');
    const visited = new Set<string>();
    
    if (startNode) {
      visited.add(startNode.id);
    }
    
    this.session.stepHistory.forEach((step) => {
      visited.add(step.nodeId);
    });
    
    return Array.from(visited);
  }

  canMakeDecision(): boolean {
    if (!this.session) return false;
    return (
      this.session.status === 'playing' &&
      !this.session.hasNegativeResources &&
      this.getAvailableDecisions().length > 0
    );
  }

  getStatus(): GameStatus | null {
    return this.session?.status || null;
  }

  static validateLevel(level: Level): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!level.id) errors.push('关卡ID不能为空');
    if (!level.name) errors.push('关卡名称不能为空');
    if (!level.nodes || level.nodes.length === 0) errors.push('关卡至少需要一个节点');
    
    const startNodes = level.nodes.filter((n) => n.type === 'start');
    const endNodes = level.nodes.filter((n) => n.type === 'end');
    
    if (startNodes.length !== 1) errors.push('关卡必须有且仅有一个起点');
    if (endNodes.length < 1) errors.push('关卡至少需要一个终点');
    
    const nodeIds = new Set(level.nodes.map((n) => n.id));
    level.paths.forEach((path, index) => {
      if (!nodeIds.has(path.from)) {
        errors.push(`路径 ${index}: 起点 ${path.from} 不存在`);
      }
      if (!nodeIds.has(path.to)) {
        errors.push(`路径 ${index}: 终点 ${path.to} 不存在`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  static calculateResourcesFromSteps(
    initialResources: Resources,
    steps: { effects: ResourceEffect[] }[]
  ): Resources {
    return steps.reduce(
      (resources, step) => applyResourceEffects(resources, step.effects),
      { ...initialResources }
    );
  }
}
