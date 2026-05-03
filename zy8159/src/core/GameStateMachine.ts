import {
  GameState,
  GamePhase,
  GameResult,
  Custodian,
  Guard,
  Artifact,
  DisplayCase,
  Position,
  LogEntry,
  GameConfig
} from '../types';
import { MapSystem } from './MapSystem';
import { EventSystem } from './EventSystem';
import { RulesEngine } from './RulesEngine';

export class GameStateMachine {
  private state: GameState;
  private mapSystem: MapSystem;
  private eventSystem: EventSystem;
  private rulesEngine: RulesEngine;
  private initialConfig: GameConfig;

  constructor(config: GameConfig) {
    this.initialConfig = this.cloneConfig(config);
    this.mapSystem = new MapSystem(config.map);
    this.eventSystem = new EventSystem(config.eventCards);
    this.rulesEngine = new RulesEngine(this.mapSystem);

    this.state = this.createInitialState(config);
  }

  private cloneConfig(config: GameConfig): GameConfig {
    return JSON.parse(JSON.stringify(config));
  }

  private createInitialState(config: GameConfig): GameState {
    return {
      turn: 1,
      phase: 'planning',
      result: 'inProgress',
      isPowerOutage: false,
      powerOutageTurnsRemaining: 0,
      custodians: this.cloneCustodians(config.custodians),
      guards: this.cloneGuards(config.guards),
      displayCases: this.cloneDisplayCases(config.displayCases),
      artifacts: this.cloneArtifacts(config.artifacts),
      activeEvents: [],
      risks: [],
      logs: [
        {
          turn: 0,
          timestamp: Date.now(),
          type: 'info',
          message: '游戏开始！将所有文物安全转移到出口。',
          details: `目标：在 ${config.maxTurns} 回合内转移 ${config.totalArtifactsToSecure} 件文物`
        }
      ],
      securedArtifactsCount: 0,
      totalArtifactsToSecure: config.totalArtifactsToSecure,
      maxTurns: config.maxTurns
    };
  }

  private cloneCustodians(custodians: Custodian[]): Custodian[] {
    return custodians.map(c => ({ ...c }));
  }

  private cloneGuards(guards: Guard[]): Guard[] {
    return guards.map(g => ({ ...g, patrolRoute: [...g.patrolRoute] }));
  }

  private cloneDisplayCases(cases: DisplayCase[]): DisplayCase[] {
    return cases.map(c => ({ ...c }));
  }

  private cloneArtifacts(artifacts: Artifact[]): Artifact[] {
    return artifacts.map(a => ({ ...a }));
  }

  getState(): GameState {
    return {
      ...this.state,
      custodians: this.cloneCustodians(this.state.custodians),
      guards: this.cloneGuards(this.state.guards),
      displayCases: this.cloneDisplayCases(this.state.displayCases),
      artifacts: this.cloneArtifacts(this.state.artifacts),
      activeEvents: [...this.state.activeEvents],
      risks: [...this.state.risks],
      logs: [...this.state.logs]
    };
  }

  getMapSystem(): MapSystem {
    return this.mapSystem;
  }

  getRulesEngine(): RulesEngine {
    return this.rulesEngine;
  }

  getInitialConfig(): GameConfig {
    return this.cloneConfig(this.initialConfig);
  }

  setPhase(phase: GamePhase): void {
    this.state.phase = phase;
    this.addLog('info', `进入阶段: ${phase}`);
  }

  selectCustodian(custodianId: string): boolean {
    const custodian = this.state.custodians.find(c => c.id === custodianId);
    if (!custodian) {
      return false;
    }

    this.state.custodians.forEach(c => {
      c.isSelected = c.id === custodianId;
    });

    return true;
  }

  getSelectedCustodian(): Custodian | null {
    return this.state.custodians.find(c => c.isSelected) || null;
  }

  moveCustodian(custodianId: string, targetPos: Position): { success: boolean; reason?: string } {
    const custodian = this.state.custodians.find(c => c.id === custodianId);
    if (!custodian) {
      return { success: false, reason: '保管员不存在' };
    }

    if (this.state.phase !== 'playerAction') {
      return { success: false, reason: '当前阶段无法移动' };
    }

    const checkResult = this.rulesEngine.canCustodianMoveTo(
      custodian,
      targetPos,
      this.state.custodians,
      this.state.guards,
      this.state.isPowerOutage
    );

    if (!checkResult.valid) {
      return { success: false, reason: checkResult.reason };
    }

    const oldPos = { ...custodian.position };
    custodian.position = { ...targetPos };
    custodian.canMove = false;

    this.addLog(
      'info',
      `${custodian.name} 从 (${oldPos.x}, ${oldPos.y}) 移动到 (${targetPos.x}, ${targetPos.y})`
    );

    return { success: true };
  }

  unlockCase(custodianId: string, caseId: string): { success: boolean; reason?: string } {
    const custodian = this.state.custodians.find(c => c.id === custodianId);
    const displayCase = this.state.displayCases.find(dc => dc.id === caseId);

    if (!custodian || !displayCase) {
      return { success: false, reason: '保管员或展柜不存在' };
    }

    if (this.state.phase !== 'playerAction') {
      return { success: false, reason: '当前阶段无法操作' };
    }

    const checkResult = this.rulesEngine.canCustodianUnlockCase(custodian, displayCase);
    if (!checkResult.valid) {
      return { success: false, reason: checkResult.reason };
    }

    displayCase.isLocked = false;

    this.addLog(
      'info',
      `${custodian.name} 解锁了展柜 ${caseId}`
    );

    return { success: true };
  }

  collectArtifact(custodianId: string, artifactId: string): { success: boolean; reason?: string } {
    const custodian = this.state.custodians.find(c => c.id === custodianId);
    const artifact = this.state.artifacts.find(a => a.id === artifactId);

    if (!custodian || !artifact) {
      return { success: false, reason: '保管员或文物不存在' };
    }

    const displayCase = this.state.displayCases.find(dc => dc.artifactId === artifactId);
    if (!displayCase) {
      return { success: false, reason: '找不到对应的展柜' };
    }

    if (this.state.phase !== 'playerAction') {
      return { success: false, reason: '当前阶段无法操作' };
    }

    const checkResult = this.rulesEngine.canCustodianCollectArtifact(
      custodian,
      displayCase,
      artifact
    );

    if (!checkResult.valid) {
      return { success: false, reason: checkResult.reason };
    }

    artifact.isCollected = true;
    displayCase.artifactId = null;
    custodian.carriedArtifacts.push(artifactId);
    custodian.currentLoad += artifact.weight;

    this.addLog(
      'success',
      `${custodian.name} 收集了文物: ${artifact.name} (重量: ${artifact.weight})`
    );

    return { success: true };
  }

  depositArtifact(custodianId: string, artifactId: string): { success: boolean; reason?: string } {
    const custodian = this.state.custodians.find(c => c.id === custodianId);
    const artifact = this.state.artifacts.find(a => a.id === artifactId);

    if (!custodian || !artifact) {
      return { success: false, reason: '保管员或文物不存在' };
    }

    if (this.state.phase !== 'playerAction') {
      return { success: false, reason: '当前阶段无法操作' };
    }

    const checkResult = this.rulesEngine.canCustodianDepositArtifact(custodian, artifactId);
    if (!checkResult.valid) {
      return { success: false, reason: checkResult.reason };
    }

    artifact.isSecured = true;
    artifact.isCollected = false;
    custodian.carriedArtifacts = custodian.carriedArtifacts.filter(
      id => id !== artifactId
    );
    custodian.currentLoad -= artifact.weight;
    this.state.securedArtifactsCount++;

    this.addLog(
      'success',
      `${custodian.name} 在安全出口存放了文物: ${artifact.name} (${this.state.securedArtifactsCount}/${this.state.totalArtifactsToSecure})`
    );

    return { success: true };
  }

  endTurn(): GameState {
    this.addLog('info', `--- 第 ${this.state.turn} 回合结束 ---`);

    this.setPhase('guardAction');
    this.processGuardTurn();

    this.setPhase('eventPhase');
    this.processEventPhase();

    this.setPhase('riskCheck');
    this.processRiskCheck();

    const gameEndResult = this.checkGameEnd();
    if (gameEndResult !== 'inProgress') {
      this.state.result = gameEndResult;
      this.setPhase('gameOver');
      return this.getState();
    }

    this.state.turn++;
    this.state.custodians.forEach(c => {
      c.canMove = true;
    });

    this.setPhase('playerAction');
    this.addLog('info', `--- 第 ${this.state.turn} 回合开始 ---`);

    return this.getState();
  }

  private processGuardTurn(): void {
    for (const guard of this.state.guards) {
      const oldPos = { ...guard.position };
      const nextPos = this.rulesEngine.calculateGuardNextPosition(guard);

      if (!this.mapSystem.positionsEqual(oldPos, nextPos)) {
        guard.position = { ...nextPos };
        guard.currentRouteIndex = (guard.currentRouteIndex + 1) % guard.patrolRoute.length;
        guard.direction = this.rulesEngine.calculateGuardNewDirection(oldPos, nextPos);

        this.addLog(
          'info',
          `安保人员 ${guard.name} 从 (${oldPos.x}, ${oldPos.y}) 巡逻到 (${nextPos.x}, ${nextPos.y})`
        );
      }
    }
  }

  private processEventPhase(): void {
    this.eventSystem.setCurrentTurn(this.state.turn);

    const triggeredEvents = this.eventSystem.triggerEventsForTurn(this.state.turn);

    for (const event of triggeredEvents) {
      if (event.id === 'power_outage') {
        this.state.isPowerOutage = true;
        this.state.powerOutageTurnsRemaining = event.duration;
        this.addLog('warning', '⚠️ 电力故障！安保人员视野减半。');
      }
    }

    const randomEvent = this.eventSystem.triggerRandomEvent(this.state.turn);
    if (randomEvent && randomEvent.id === 'power_outage') {
      this.state.isPowerOutage = true;
      this.state.powerOutageTurnsRemaining = randomEvent.duration;
      this.addLog('warning', '⚠️ 随机事件：电力故障！');
    }

    const { ended } = this.eventSystem.updateActiveEvents();
    for (const event of ended) {
      if (event.id === 'power_outage') {
        this.state.isPowerOutage = false;
        this.state.powerOutageTurnsRemaining = 0;
        this.addLog('info', '✅ 电力恢复正常。');
      }
    }

    if (this.state.isPowerOutage) {
      this.state.powerOutageTurnsRemaining = this.eventSystem.getPowerOutageTurnsRemaining();
    }

    this.state.activeEvents = this.eventSystem.getActiveEvents();

    const newLogs = this.eventSystem.getLogs();
    this.state.logs.push(...newLogs);
    this.eventSystem.clearLogs();
  }

  private processRiskCheck(): void {
    this.state.risks = [];

    const detectionResult = this.rulesEngine.checkGuardDetection(
      this.state.custodians,
      this.state.guards,
      this.state.isPowerOutage
    );

    if (detectionResult.risks.length > 0) {
      this.state.risks.push(...detectionResult.risks);
    }

    const remainingArtifacts = this.state.artifacts.filter(
      a => !a.isSecured
    ).length;

    const timeoutRisk = this.rulesEngine.checkTimeoutRisk(
      this.state.turn,
      this.state.maxTurns,
      remainingArtifacts
    );

    if (timeoutRisk) {
      this.state.risks.push(timeoutRisk);
      if (timeoutRisk.severity === 'critical') {
        this.addLog('danger', timeoutRisk.description);
      } else {
        this.addLog('warning', timeoutRisk.description);
      }
    }

    const powerRisk = this.rulesEngine.checkPowerFailureRisk(this.state.isPowerOutage);
    if (powerRisk) {
      this.state.risks.push(powerRisk);
    }

    const newLogs = this.rulesEngine.getLogs();
    this.state.logs.push(...newLogs);
    this.rulesEngine.clearLogs();
  }

  private checkGameEnd(): GameResult {
    if (this.state.risks.some(r => r.type === 'guardDetection' && r.severity === 'critical')) {
      this.addLog('danger', '💀 游戏失败！保管员被安保人员发现。');
      return 'defeat';
    }

    if (this.state.securedArtifactsCount >= this.state.totalArtifactsToSecure) {
      this.addLog('success', '🎉 胜利！所有文物已安全转移！');
      return 'victory';
    }

    if (this.state.turn >= this.state.maxTurns) {
      this.addLog('danger', '⏰ 超时！未能在规定时间内完成撤展。');
      return 'timeout';
    }

    return 'inProgress';
  }

  private addLog(type: LogEntry['type'], message: string, details?: string): void {
    const entry: LogEntry = {
      turn: this.state.turn,
      timestamp: Date.now(),
      type,
      message,
      details
    };
    this.state.logs.push(entry);
    this.rulesEngine.addLog(entry);
  }

  reset(): void {
    this.mapSystem = new MapSystem(this.initialConfig.map);
    this.eventSystem = new EventSystem(this.initialConfig.eventCards);
    this.rulesEngine = new RulesEngine(this.mapSystem);
    this.state = this.createInitialState(this.initialConfig);
  }

  startGame(): GameState {
    this.state.phase = 'playerAction';
    this.addLog('info', '游戏开始！请规划保管员的移动路线。');
    return this.getState();
  }
}
