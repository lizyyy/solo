import type {
  LevelConfig,
  GameRound,
  Operation,
  OperationType,
  ValidationResult,
  Effect,
  JudgementTrace,
} from '@/types/game';
import { generateId, getCurrentTimestamp, getOperatorName } from '@/utils/storage';

export class GameEngine {
  private level: LevelConfig;
  private round: GameRound | null = null;
  private resources: number = 0;
  private score: number = 0;
  private risk: number = 0;
  private operations: Operation[] = [];
  private isPaused: boolean = false;

  constructor(level: LevelConfig) {
    this.level = level;
    this.resources = level.initialResources;
    this.score = 0;
    this.risk = 0;
  }

  getState() {
    return {
      currentRound: this.round,
      resources: this.resources,
      score: this.score,
      risk: this.risk,
      operations: this.operations,
      isPaused: this.isPaused,
      currentLevel: this.level,
    };
  }

  startRound(playerName: string, source: string = '黑胶节拍修复赛'): GameRound {
    const round: GameRound = {
      id: generateId(),
      levelId: this.level.id,
      levelName: this.level.name,
      playerName,
      initialResources: this.level.initialResources,
      targetScore: this.level.targetScore,
      finalScore: 0,
      finalResources: this.level.initialResources,
      finalRisk: 0,
      status: 'active',
      startTime: getCurrentTimestamp(),
      operator: getOperatorName(),
      source,
    };

    this.round = round;
    this.resources = this.level.initialResources;
    this.score = 0;
    this.risk = 0;
    this.operations = [];
    this.isPaused = false;

    return round;
  }

  pauseRound(): void {
    if (!this.round || this.round.status !== 'active') return;

    this.round.status = 'paused';
    this.round.pausedAt = getCurrentTimestamp();
    this.isPaused = true;
  }

  resumeRound(): void {
    if (!this.round || this.round.status !== 'paused') return;

    this.round.status = 'active';
    this.round.resumedAt = getCurrentTimestamp();
    this.isPaused = false;
  }

  endRound(): GameRound {
    if (!this.round) {
      throw new Error('No active round to end');
    }

    this.round.status = 'completed';
    this.round.endTime = getCurrentTimestamp();
    this.round.finalScore = this.score;
    this.round.finalResources = this.resources;
    this.round.finalRisk = this.risk;

    return this.round;
  }

  validateOperation(
    operationType: OperationType,
    elementId: string
  ): ValidationResult {
    if (!this.round || this.round.status !== 'active' || this.isPaused) {
      return {
        allowed: false,
        reason: '比赛未开始、已暂停或已结束，无法执行操作',
      };
    }

    const effects = this.getEffects(operationType, elementId);
    if (!effects) {
      return {
        allowed: false,
        reason: `未找到元素 "${elementId}" 的${operationType === 'drag' ? '拖拽' : '点击'}效果配置`,
      };
    }

    const newResources = this.resources + effects.resource;
    if (this.level.rules.negativeResourceBlocked && newResources < 0 && effects.resource < 0) {
      return {
        allowed: false,
        reason: `资源不足！当前资源 ${this.resources}，此操作消耗 ${Math.abs(effects.resource)}，会导致资源为负 (${newResources})。请先执行增加资源的操作。`,
      };
    }

    if (newResources < 0) {
      return {
        allowed: true,
        warning: `注意：此操作后资源将变为负数 (${newResources})，已记录此异常情况`,
      };
    }

    return { allowed: true };
  }

  getEffects(operationType: OperationType, elementId: string): Effect | null {
    const effectsMap = operationType === 'drag' 
      ? this.level.rules.dragEffects 
      : this.level.rules.clickEffects;
    
    return effectsMap[elementId] || null;
  }

  processDrag(
    elementId: string,
    elementLabel: string,
    position: { x: number; y: number },
    note: string = '',
    source: Operation['source'] = '黑胶节拍修复赛'
  ): Operation | null {
    return this.processOperation('drag', elementId, elementLabel, position, note, source);
  }

  processClick(
    elementId: string,
    elementLabel: string,
    note: string = '',
    source: Operation['source'] = '黑胶节拍修复赛'
  ): Operation | null {
    return this.processOperation('click', elementId, elementLabel, undefined, note, source);
  }

  private processOperation(
    type: OperationType,
    elementId: string,
    elementLabel: string,
    position?: { x: number; y: number },
    note: string = '',
    source: Operation['source'] = '黑胶节拍修复赛'
  ): Operation | null {
    const validation = this.validateOperation(type, elementId);
    if (!validation.allowed) {
      console.warn(`[GameEngine] Operation rejected: ${validation.reason}`);
      return null;
    }

    const effects = this.getEffects(type, elementId);
    if (!effects) return null;

    const judgementTrace = this.createJudgementTrace(type, elementId, effects, validation);

    const oldResources = this.resources;
    const oldScore = this.score;
    const oldRisk = this.risk;

    this.resources += effects.resource;
    this.score += effects.score;
    this.risk += effects.risk;

    if (this.resources < 0) {
      console.warn(`[GameEngine] Resources went negative: ${this.resources}`);
    }

    const operation: Operation = {
      id: generateId(),
      roundId: this.round!.id,
      type,
      element: elementId,
      elementLabel,
      resourceDelta: effects.resource,
      scoreDelta: effects.score,
      riskDelta: effects.risk,
      resourcesAfter: this.resources,
      scoreAfter: this.score,
      riskAfter: this.risk,
      timestamp: getCurrentTimestamp(),
      source,
      note: note || validation.warning || '',
      operator: getOperatorName(),
      isJudgementCall: this.resources < 0,
      judgementReason: this.resources < 0 ? '资源变负，已记录异常情况' : undefined,
      judgementTrace,
      position,
    };

    this.operations.push(operation);

    if (this.round) {
      this.round.finalScore = this.score;
      this.round.finalResources = this.resources;
      this.round.finalRisk = this.risk;
    }

    console.debug('[GameEngine] Operation processed:', {
      element: elementLabel,
      type,
      before: { resources: oldResources, score: oldScore, risk: oldRisk },
      after: { resources: this.resources, score: this.score, risk: this.risk },
      delta: effects,
    });

    return operation;
  }

  private createJudgementTrace(
    type: OperationType,
    elementId: string,
    effects: Effect,
    validation: ValidationResult
  ): JudgementTrace {
    const rulesApplied: string[] = [
      `[黑胶节拍修复赛] 操作类型：${type === 'drag' ? '拖拽' : '点击'}`,
      `[黑胶节拍修复赛] 目标元素：${elementId}`,
      `[黑胶节拍修复赛] 资源变化：${effects.resource > 0 ? '+' : ''}${effects.resource}`,
      `[黑胶节拍修复赛] 分数变化：${effects.score > 0 ? '+' : ''}${effects.score}`,
      `[黑胶节拍修复赛] 风险变化：${effects.risk > 0 ? '+' : ''}${effects.risk}`,
    ];

    if (this.level.rules.negativeResourceBlocked) {
      rulesApplied.push('[黑胶节拍修复赛] 规则：负数资源阻止消耗操作');
    }

    if (validation.warning) {
      rulesApplied.push(`[黑胶节拍修复赛] 警告：${validation.warning}`);
    }

    const decision = validation.allowed 
      ? (validation.warning ? '操作允许但有警告' : '操作允许')
      : '操作被拒绝';

    return {
      rulesApplied,
      decision,
      timestamp: getCurrentTimestamp(),
      module: '黑胶节拍修复赛-判断引擎',
    };
  }

  applyJudgementCall(
    operationId: string,
    revert: boolean,
    reason: string
  ): Operation | null {
    const operationIndex = this.operations.findIndex(op => op.id === operationId);
    if (operationIndex === -1) return null;

    const operation = this.operations[operationIndex];
    
    if (revert) {
      this.resources -= operation.resourceDelta;
      this.score -= operation.scoreDelta;
      this.risk -= operation.riskDelta;
      
      operation.resourcesAfter = this.resources;
      operation.scoreAfter = this.score;
      operation.riskAfter = this.risk;
    }

    operation.isJudgementCall = true;
    operation.judgementReason = reason;
    operation.operator = getOperatorName();

    if (this.round) {
      this.round.finalScore = this.score;
      this.round.finalResources = this.resources;
      this.round.finalRisk = this.risk;
    }

    return operation;
  }

  getRiskLevel(): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = this.risk / this.level.riskThreshold;
    if (ratio < 0.3) return 'low';
    if (ratio < 0.6) return 'medium';
    if (ratio < 1.0) return 'high';
    return 'critical';
  }

  hasNegativeResources(): boolean {
    return this.resources < 0;
  }

  getOperationCount(): number {
    return this.operations.length;
  }

  static validateLevelConfig(level: unknown): level is LevelConfig {
    if (typeof level !== 'object' || level === null) return false;
    
    const l = level as Record<string, unknown>;
    return (
      typeof l.id === 'string' &&
      typeof l.name === 'string' &&
      typeof l.initialResources === 'number' &&
      typeof l.targetScore === 'number' &&
      typeof l.riskThreshold === 'number' &&
      typeof l.rules === 'object' &&
      l.rules !== null &&
      typeof (l.rules as Record<string, unknown>).dragEffects === 'object' &&
      typeof (l.rules as Record<string, unknown>).clickEffects === 'object'
    );
  }
}
