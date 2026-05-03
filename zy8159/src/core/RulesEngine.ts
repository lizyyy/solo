import {
  Position,
  Custodian,
  Guard,
  DisplayCase,
  Artifact,
  Risk,
  LogEntry
} from '../types';
import { MapSystem } from './MapSystem';

export class RulesEngine {
  private mapSystem: MapSystem;
  private logs: LogEntry[];
  private currentTurn: number;

  constructor(mapSystem: MapSystem) {
    this.mapSystem = mapSystem;
    this.logs = [];
    this.currentTurn = 1;
  }

  setCurrentTurn(turn: number): void {
    this.currentTurn = turn;
  }

  canCustodianMoveTo(
    custodian: Custodian,
    targetPos: Position,
    allCustodians: Custodian[],
    allGuards: Guard[],
    powerOutage: boolean
  ): { valid: boolean; reason?: string } {
    if (!custodian.canMove) {
      return { valid: false, reason: '保管员本回合已无法移动' };
    }

    if (!this.mapSystem.isValidPosition(targetPos)) {
      return { valid: false, reason: '目标位置无效' };
    }

    if (!this.mapSystem.isWalkable(targetPos, powerOutage)) {
      return { valid: false, reason: '目标位置不可通行' };
    }

    const distance = this.mapSystem.getDistance(custodian.position, targetPos);
    if (distance !== 1) {
      return { valid: false, reason: '每次只能移动一格' };
    }

    const occupiedByCustodian = allCustodians.some(
      c => c.id !== custodian.id && 
           c.position.x === targetPos.x && 
           c.position.y === targetPos.y
    );
    if (occupiedByCustodian) {
      return { valid: false, reason: '目标位置已被其他保管员占用' };
    }

    const occupiedByGuard = allGuards.some(
      g => g.position.x === targetPos.x && g.position.y === targetPos.y
    );
    if (occupiedByGuard) {
      return { valid: false, reason: '目标位置有安保人员，无法进入' };
    }

    return { valid: true };
  }

  canCustodianCollectArtifact(
    custodian: Custodian,
    displayCase: DisplayCase,
    artifact: Artifact
  ): { valid: boolean; reason?: string } {
    const atCase = this.mapSystem.positionsEqual(
      custodian.position,
      displayCase.position
    );
    if (!atCase) {
      return { valid: false, reason: '保管员不在展柜位置' };
    }

    if (displayCase.isLocked) {
      return { valid: false, reason: '展柜已锁定，请先解锁' };
    }

    if (artifact.isCollected || artifact.isSecured) {
      return { valid: false, reason: '文物已被收集或已安全' };
    }

    const newLoad = custodian.currentLoad + artifact.weight;
    if (newLoad > custodian.maxLoad) {
      return {
        valid: false,
        reason: `载重超限！当前载重: ${custodian.currentLoad}, 文物重量: ${artifact.weight}, 最大载重: ${custodian.maxLoad}`
      };
    }

    return { valid: true };
  }

  canCustodianDepositArtifact(
    custodian: Custodian,
    artifactId: string
  ): { valid: boolean; reason?: string } {
    if (!this.mapSystem.isExit(custodian.position)) {
      return { valid: false, reason: '保管员不在安全出口位置' };
    }

    if (!custodian.carriedArtifacts.includes(artifactId)) {
      return { valid: false, reason: '保管员未携带此文物' };
    }

    return { valid: true };
  }

  canCustodianUnlockCase(
    custodian: Custodian,
    displayCase: DisplayCase
  ): { valid: boolean; reason?: string } {
    const atCase = this.mapSystem.positionsEqual(
      custodian.position,
      displayCase.position
    );
    if (!atCase) {
      return { valid: false, reason: '保管员不在展柜位置' };
    }

    if (!displayCase.isLocked) {
      return { valid: false, reason: '展柜已解锁' };
    }

    return { valid: true };
  }

  checkGuardDetection(
    custodians: Custodian[],
    guards: Guard[],
    powerOutage: boolean
  ): { detected: Custodian[]; risks: Risk[] } {
    const detectedCustodians: Custodian[] = [];
    const risks: Risk[] = [];

    for (const guard of guards) {
      const visionCells = this.mapSystem.getGuardVisionCells(
        guard.position,
        guard.direction,
        powerOutage ? Math.floor(guard.viewRange / 2) : guard.viewRange
      );

      for (const custodian of custodians) {
        if (detectedCustodians.some(c => c.id === custodian.id)) {
          continue;
        }

        const inVision = visionCells.some(
          cell => this.mapSystem.positionsEqual(cell, custodian.position)
        );

        if (inVision) {
          detectedCustodians.push(custodian);

          const risk: Risk = {
            id: `detection_${Date.now()}_${custodian.id}`,
            type: 'guardDetection',
            severity: 'critical',
            description: `保管员 ${custodian.name} 被安保人员 ${guard.name} 发现！`,
            relatedEntities: [custodian.id, guard.id]
          };
          risks.push(risk);

          const logEntry: LogEntry = {
            turn: this.currentTurn,
            timestamp: Date.now(),
            type: 'danger',
            message: `危险！${custodian.name} 被 ${guard.name} 发现！`,
            details: `位置: (${custodian.position.x}, ${custodian.position.y})`
          };
          this.logs.push(logEntry);
        }
      }
    }

    return { detected: detectedCustodians, risks };
  }

  checkRouteConflicts(
    custodians: Custodian[],
    plannedMoves: Map<string, Position>
  ): Risk[] {
    const risks: Risk[] = [];
    const targetPositions = new Map<string, string[]>();

    for (const [custodianId, targetPos] of plannedMoves) {
      const posKey = `${targetPos.x},${targetPos.y}`;
      if (!targetPositions.has(posKey)) {
        targetPositions.set(posKey, []);
      }
      targetPositions.get(posKey)!.push(custodianId);
    }

    for (const [posKey, custodianIds] of targetPositions) {
      if (custodianIds.length > 1) {
        const custodiansAtPos = custodians.filter(c =>
          custodianIds.includes(c.id)
        );

        const risk: Risk = {
          id: `conflict_${Date.now()}`,
          type: 'routeConflict',
          severity: 'high',
          description: `多名保管员计划移动到同一位置 (${posKey})，可能发生路线冲突！`,
          relatedEntities: custodianIds
        };
        risks.push(risk);

        const logEntry: LogEntry = {
          turn: this.currentTurn,
          timestamp: Date.now(),
          type: 'warning',
          message: `路线冲突警告：${custodiansAtPos.map(c => c.name).join('、')} 计划移动到同一位置`,
          details: `目标位置: (${posKey})`
        };
        this.logs.push(logEntry);
      }
    }

    return risks;
  }

  checkTimeoutRisk(
    currentTurn: number,
    maxTurns: number,
    remainingArtifacts: number
  ): Risk | null {
    const turnsRemaining = maxTurns - currentTurn;

    if (turnsRemaining <= 0) {
      return {
        id: `timeout_${Date.now()}`,
        type: 'timeout',
        severity: 'critical',
        description: '游戏超时！未能在规定回合内完成撤展任务。',
        relatedEntities: []
      };
    }

    if (remainingArtifacts > 0) {
      const estimatedTurnsNeeded = remainingArtifacts * 2;

      if (turnsRemaining <= estimatedTurnsNeeded) {
        return {
          id: `timeout_risk_${Date.now()}`,
          type: 'timeout',
          severity: turnsRemaining <= 3 ? 'critical' : 'high',
          description: `时间紧迫！剩余 ${remainingArtifacts} 件文物待撤展，仅剩 ${turnsRemaining} 回合。`,
          relatedEntities: []
        };
      }
    }

    return null;
  }

  checkPowerFailureRisk(powerOutage: boolean): Risk | null {
    if (powerOutage) {
      return {
        id: `power_${Date.now()}`,
        type: 'powerFailure',
        severity: 'medium',
        description: '电力故障！安保人员视野范围减半，但移动操作不受影响。',
        relatedEntities: []
      };
    }
    return null;
  }

  calculateGuardNextPosition(guard: Guard): Position {
    if (guard.patrolRoute.length === 0) {
      return guard.position;
    }

    const nextIndex = (guard.currentRouteIndex + 1) % guard.patrolRoute.length;
    return guard.patrolRoute[nextIndex];
  }

  calculateGuardNewDirection(
    fromPos: Position,
    toPos: Position
  ): 'up' | 'down' | 'left' | 'right' {
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;

    if (dx > 0) return 'right';
    if (dx < 0) return 'left';
    if (dy > 0) return 'down';
    if (dy < 0) return 'up';

    return 'down';
  }

  getCustodianLoadPercentage(custodian: Custodian): number {
    return (custodian.currentLoad / custodian.maxLoad) * 100;
  }

  isCustodianOverloaded(custodian: Custodian): boolean {
    return custodian.currentLoad > custodian.maxLoad;
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  addLog(entry: LogEntry): void {
    this.logs.push(entry);
  }
}
