import type {
  GameState,
  LevelConfig,
  Target,
  NoiseSource,
  Echo,
  Position,
  ScanType,
  PlayerAction,
  ScoreResult,
  Grade,
  ExportReport,
} from '@/types/game';
import {
  distance,
  chebyshevDistance,
  isInFanShape,
  randomInt,
  randomFloat,
  generateId,
  clamp,
  directionToVector,
  getBearingText,
  positionToString,
} from '@/utils/math';

const PLAYER_POSITION: Position = { x: 0, y: 0 };

export class GameEngine {
  private state: GameState;

  constructor(level: LevelConfig) {
    this.state = this.initializeGame(level);
  }

  private initializeGame(level: LevelConfig): GameState {
    const targets = this.generateTargets(level);
    const noiseSources = this.generateNoiseSources(level);

    return {
      level,
      currentTurn: 1,
      energy: level.initialEnergy,
      maxEnergy: level.initialEnergy,
      targets,
      noiseSources,
      echoes: [],
      destroyedTargets: 0,
      escapedTargets: 0,
      missedAttacks: 0,
      civilianHits: 0,
      scanCooldowns: {
        active: 0,
        fan: 0,
        passive: 0,
        attack: 0,
      },
      selectedPosition: null,
      actions: [],
      gameStatus: 'playing',
      score: 0,
      startTime: Date.now(),
      turnHistory: [],
    };
  }

  private generateTargets(level: LevelConfig): Target[] {
    const targets: Target[] = [];
    const minDistance = Math.floor(level.gridSize * 0.4);

    for (let i = 0; i < level.targetCount; i++) {
      let position: Position;
      let attempts = 0;

      do {
        position = {
          x: randomInt(minDistance, level.gridSize - 1),
          y: randomInt(minDistance, level.gridSize - 1),
        };
        attempts++;
      } while (
        attempts < 100 &&
        targets.some(t => distance(t.position, position) < 3)
      );

      targets.push({
        id: generateId(),
        position,
        direction: randomInt(0, 7),
        speed: 1,
        isDestroyed: false,
        hasEscaped: false,
        wasDetected: false,
        avoidanceMode: false,
        avoidanceTurns: 0,
        trajectory: [{ ...position }],
      });
    }

    return targets;
  }

  private generateNoiseSources(level: LevelConfig): NoiseSource[] {
    const sources: NoiseSource[] = [];
    const gridSize = level.gridSize;

    for (let i = 0; i < level.noiseSourceCount; i++) {
      let position: Position;
      let attempts = 0;

      do {
        position = {
          x: randomInt(2, gridSize - 3),
          y: randomInt(2, gridSize - 3),
        };
        attempts++;
      } while (
        attempts < 100 &&
        (sources.some(s => distance(s.position, position) < 3) ||
          distance(position, PLAYER_POSITION) < 3)
      );

      sources.push({
        id: generateId(),
        position,
        intensity: randomInt(1, 3),
      });
    }

    return sources;
  }

  getState(): GameState {
    return { ...this.state };
  }

  setState(state: GameState): void {
    this.state = state;
  }

  selectPosition(position: Position | null): void {
    this.state.selectedPosition = position;
  }

  canPerformAction(type: ScanType): { allowed: boolean; reason: string } {
    const config = this.state.level.scanConfigs[type];

    if (this.state.gameStatus !== 'playing') {
      return { allowed: false, reason: '游戏已结束' };
    }

    if (this.state.scanCooldowns[type] > 0) {
      return { allowed: false, reason: `冷却中，还需${this.state.scanCooldowns[type]}回合` };
    }

    if (this.state.energy < config.energyCost) {
      return { allowed: false, reason: `能量不足，需要${config.energyCost}点能量` };
    }

    if (type === 'attack' && !this.state.selectedPosition) {
      return { allowed: false, reason: '请先选择攻击目标格子' };
    }

    return { allowed: true, reason: '' };
  }

  performScan(type: 'active' | 'fan' | 'passive'): { echoes: Echo[]; logMessages: string[] } {
    const check = this.canPerformAction(type);
    if (!check.allowed) {
      return { echoes: [], logMessages: [`[错误] ${check.reason}`] };
    }

    const config = this.state.level.scanConfigs[type];
    const logMessages: string[] = [];
    const newEchoes: Echo[] = [];

    this.state.energy -= config.energyCost;
    this.state.scanCooldowns[type] = config.cooldown;

    logMessages.push(`[回合${this.state.currentTurn}] 执行${config.name}，消耗${config.energyCost}能量`);

    const detectedTargets: Target[] = [];

    for (const target of this.state.targets) {
      if (target.isDestroyed || target.hasEscaped) continue;

      let inRange = false;

      switch (type) {
        case 'active':
          inRange = chebyshevDistance(PLAYER_POSITION, target.position) <= config.range;
          break;
        case 'fan':
          inRange = isInFanShape(
            PLAYER_POSITION,
            target.position,
            0,
            Math.PI / 3,
            config.range
          );
          break;
        case 'passive':
          inRange = true;
          break;
      }

      if (inRange) {
        detectedTargets.push(target);
      }
    }

    for (const target of detectedTargets) {
      const dist = distance(PLAYER_POSITION, target.position);
      let baseStrength = clamp(100 - dist * 5, 20, 100);
      baseStrength *= config.accuracy;

      let echoPos = { ...target.position };

      if (type === 'passive') {
        const errorOffset = randomInt(-2, 2);
        echoPos = {
          x: clamp(echoPos.x + errorOffset, 0, this.state.level.gridSize - 1),
          y: clamp(echoPos.y + errorOffset, 0, this.state.level.gridSize - 1),
        };
        baseStrength *= randomFloat(0.6, 1.0);
      }

      const echo: Echo = {
        id: generateId(),
        position: echoPos,
        signalStrength: Math.round(baseStrength),
        isNoise: false,
        sourceTargetId: target.id,
        scanType: type,
        timestamp: this.state.currentTurn,
        fadeTime: 5,
      };

      newEchoes.push(echo);
      this.state.echoes.push(echo);

      const bearing = getBearingText(PLAYER_POSITION, target.position);
      logMessages.push(
        `  → 探测到回波 [${positionToString(echoPos)}] 强度:${echo.signalStrength}% 方位:${bearing}`
      );

      if (!target.wasDetected) {
        target.wasDetected = true;
        this.state.score += 50;
        logMessages.push(`  → 首次发现目标！+50分`);
      } else {
        this.state.score += 20;
      }

      if (type === 'active' && Math.random() < 0.5) {
        target.avoidanceMode = true;
        target.avoidanceTurns = 2;
        logMessages.push(`  → 目标察觉被扫描，进入规避模式！`);
      }
    }

    for (const noise of this.state.noiseSources) {
      const dist = distance(PLAYER_POSITION, noise.position);
      let noiseChance = 0;

      switch (type) {
        case 'active':
          noiseChance = chebyshevDistance(PLAYER_POSITION, noise.position) <= config.range
            ? noise.intensity * 0.25
            : 0;
          break;
        case 'fan':
          noiseChance = isInFanShape(PLAYER_POSITION, noise.position, 0, Math.PI / 3, config.range)
            ? noise.intensity * 0.3
            : 0;
          break;
        case 'passive':
          noiseChance = noise.intensity * 0.35;
          break;
      }

      if (Math.random() < noiseChance * config.accuracy) {
        const offsetX = randomInt(-2, 2);
        const offsetY = randomInt(-2, 2);
        const noisePos = {
          x: clamp(noise.position.x + offsetX, 0, this.state.level.gridSize - 1),
          y: clamp(noise.position.y + offsetY, 0, this.state.level.gridSize - 1),
        };

        const echo: Echo = {
          id: generateId(),
          position: noisePos,
          signalStrength: Math.round(randomFloat(30, 70)),
          isNoise: true,
          scanType: type,
          timestamp: this.state.currentTurn,
          fadeTime: 4,
        };

        newEchoes.push(echo);
        this.state.echoes.push(echo);

        logMessages.push(
          `  → 可疑信号 [${positionToString(noisePos)}] 强度:${echo.signalStrength}% (可能为噪声)`
        );
      }
    }

    if (newEchoes.length === 0) {
      logMessages.push(`  → 扫描区域内未发现目标`);
    }

    const action: PlayerAction = {
      type,
      energyUsed: config.energyCost,
      timestamp: this.state.currentTurn,
      result: 'echo',
      echoCount: newEchoes.length,
    };
    this.state.actions.push(action);

    return { echoes: newEchoes, logMessages };
  }

  performAttack(): { hit: boolean; result: 'hit' | 'miss' | 'near_miss'; logMessages: string[] } {
    const check = this.canPerformAction('attack');
    if (!check.allowed) {
      return { hit: false, result: 'miss', logMessages: [`[错误] ${check.reason}`] };
    }

    const config = this.state.level.scanConfigs.attack;
    const targetPos = this.state.selectedPosition!;
    const logMessages: string[] = [];

    this.state.energy -= config.energyCost;
    this.state.scanCooldowns.attack = config.cooldown;

    logMessages.push(
      `[回合${this.state.currentTurn}] 对 [${positionToString(targetPos)}] 投放深水炸弹，消耗${config.energyCost}能量`
    );

    let hitTarget: Target | null = null;
    let nearMiss = false;

    for (const target of this.state.targets) {
      if (target.isDestroyed || target.hasEscaped) continue;

      const dist = distance(target.position, targetPos);

      if (dist < 0.5) {
        hitTarget = target;
        break;
      } else if (dist <= 2) {
        nearMiss = true;
      }
    }

    let result: 'hit' | 'miss' | 'near_miss' = 'miss';

    if (hitTarget) {
      hitTarget.isDestroyed = true;
      this.state.destroyedTargets++;
      this.state.score += 100;
      result = 'hit';
      logMessages.push(`  → 命中目标！目标已被摧毁 +100分`);
    } else if (nearMiss) {
      result = 'near_miss';
      this.state.missedAttacks++;
      logMessages.push(`  → 近失！目标在2格范围内，未命中 -10分`);
      this.state.score = Math.max(0, this.state.score - 10);
    } else {
      result = 'miss';
      this.state.missedAttacks++;
      logMessages.push(`  → 未命中目标 -10分`);
      this.state.score = Math.max(0, this.state.score - 10);
    }

    const action: PlayerAction = {
      type: 'attack',
      position: targetPos,
      energyUsed: config.energyCost,
      timestamp: this.state.currentTurn,
      result,
    };
    this.state.actions.push(action);

    this.checkGameEnd();

    return { hit: result === 'hit', result, logMessages };
  }

  endTurn(): { logMessages: string[]; targetsMoved: number } {
    if (this.state.gameStatus !== 'playing') {
      return { logMessages: [], targetsMoved: 0 };
    }

    const logMessages: string[] = [];
    let movedCount = 0;

    logMessages.push(`[回合${this.state.currentTurn}] 回合结束，敌方潜艇移动中...`);

    for (const target of this.state.targets) {
      if (target.isDestroyed || target.hasEscaped) continue;

      let speed = target.speed;
      if (target.avoidanceMode) {
        speed = Math.min(speed + 1, 2);
        target.avoidanceTurns--;
        if (target.avoidanceTurns <= 0) {
          target.avoidanceMode = false;
        }
      }

      if (Math.random() < 0.3) {
        target.direction = randomInt(0, 7);
        logMessages.push(`  → 目标改变航向`);
      }

      const vector = directionToVector(target.direction);
      const newX = target.position.x + vector.x * speed;
      const newY = target.position.y + vector.y * speed;

      if (newX < 0 || newX >= this.state.level.gridSize ||
          newY < 0 || newY >= this.state.level.gridSize) {
        target.hasEscaped = true;
        this.state.escapedTargets++;
        logMessages.push(`  → 目标逃离海域！`);
        continue;
      }

      target.position = { x: newX, y: newY };
      target.trajectory.push({ ...target.position });
      movedCount++;
    }

    for (const key of Object.keys(this.state.scanCooldowns) as ScanType[]) {
      if (this.state.scanCooldowns[key] > 0) {
        this.state.scanCooldowns[key]--;
      }
    }

    this.state.echoes = this.state.echoes.filter(echo => {
      echo.fadeTime--;
      return echo.fadeTime > 0;
    });

    const endTurnAction: PlayerAction = {
      type: 'end_turn',
      energyUsed: 0,
      timestamp: this.state.currentTurn,
    };
    this.state.actions.push(endTurnAction);

    this.state.turnHistory.push(JSON.parse(JSON.stringify(this.state)));

    this.state.currentTurn++;

    this.checkGameEnd();

    return { logMessages, targetsMoved: movedCount };
  }

  private checkGameEnd(): void {
    const aliveTargets = this.state.targets.filter(t => !t.isDestroyed && !t.hasEscaped);

    if (aliveTargets.length === 0) {
      this.state.gameStatus = 'victory';
      this.state.endTime = Date.now();
      this.calculateFinalScore();
      return;
    }

    if (this.state.escapedTargets > 0) {
      this.state.gameStatus = 'defeat';
      this.state.defeatReason = `有${this.state.escapedTargets}艘敌方潜艇逃离了海域`;
      this.state.endTime = Date.now();
      return;
    }

    const attackCost = this.state.level.scanConfigs.attack.energyCost;
    const minScanCost = Math.min(
      this.state.level.scanConfigs.active.energyCost,
      this.state.level.scanConfigs.passive.energyCost
    );
    const minRequired = Math.min(attackCost, minScanCost);

    if (this.state.energy < minRequired) {
      this.state.gameStatus = 'defeat';
      this.state.defeatReason = '能量耗尽，无法继续执行任务';
      this.state.endTime = Date.now();
      return;
    }
  }

  private calculateFinalScore(): ScoreResult {
    const state = this.state;
    const level = state.level;

    const baseScore = state.score;
    const targetKills = state.destroyedTargets * 100;
    const firstDetectionBonus = state.targets.filter(t => t.wasDetected).length * 50;
    const energyBonus = state.energy;
    const turnBonus = Math.max(0, (level.standardTurns - state.currentTurn) * 10);
    const penalties = state.missedAttacks * 10 + state.civilianHits * 50;

    const totalScore = baseScore + energyBonus + turnBonus - penalties;

    let grade: Grade = 'D';
    if (totalScore >= 400) grade = 'S';
    else if (totalScore >= 300) grade = 'A';
    else if (totalScore >= 200) grade = 'B';
    else if (totalScore >= 100) grade = 'C';

    const attacksPerformed = state.actions.filter(a => a.type === 'attack').length;
    const hits = state.destroyedTargets;
    const hitRate = attacksPerformed > 0 ? hits / attacksPerformed : 0;
    const energyUsed = state.maxEnergy - state.energy;
    const energyEfficiency = energyUsed > 0 ? totalScore / energyUsed : 0;
    const scansPerformed = state.actions.filter(a =>
      a.type === 'active' || a.type === 'fan' || a.type === 'passive'
    ).length;

    const result: ScoreResult = {
      totalScore,
      grade,
      breakdown: {
        baseScore,
        targetKills,
        firstDetectionBonus,
        energyBonus,
        turnBonus,
        penalties,
      },
      statistics: {
        hitRate,
        energyEfficiency,
        scansPerformed,
        attacksPerformed,
      },
    };

    state.score = totalScore;

    return result;
  }

  getScoreResult(): ScoreResult {
    return this.calculateFinalScore();
  }

  pause(): void {
    if (this.state.gameStatus === 'playing') {
      this.state.gameStatus = 'paused';
    }
  }

  resume(): void {
    if (this.state.gameStatus === 'paused') {
      this.state.gameStatus = 'playing';
    }
  }

  restart(): GameState {
    this.state = this.initializeGame(this.state.level);
    return this.state;
  }

  generateExportReport(): ExportReport {
    const scoreResult = this.calculateFinalScore();
    const state = this.state;
    const duration = state.endTime ? (state.endTime - state.startTime) / 1000 : 0;

    const report: ExportReport = {
      version: '1.0.0',
      exportTime: Date.now(),
      gameResult: state.gameStatus === 'victory' ? 'victory' : 'defeat',
      defeatReason: state.defeatReason,
      finalScore: scoreResult.totalScore,
      levelInfo: state.level,
      statistics: {
        totalTurns: state.currentTurn,
        energyUsed: state.maxEnergy - state.energy,
        energyEfficiency: scoreResult.statistics.energyEfficiency,
        hitRate: scoreResult.statistics.hitRate,
        targetsDestroyed: state.destroyedTargets,
        targetsTotal: state.targets.length,
        scansPerformed: scoreResult.statistics.scansPerformed,
        attacksPerformed: scoreResult.statistics.attacksPerformed,
        echoesDetected: state.echoes.length,
      },
      scoreBreakdown: scoreResult.breakdown,
      timeline: state.actions,
      finalGameState: JSON.parse(JSON.stringify(state)),
    };

    return report;
  }

  getPlayerPosition(): Position {
    return PLAYER_POSITION;
  }
}
