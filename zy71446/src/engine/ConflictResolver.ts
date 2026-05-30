import { ConflictLog } from '../types/anomalies';
import { generateTimestamp } from '../utils/timeUtils';

export class ConflictResolver {
  private conflictLogs: ConflictLog[] = [];

  logConflict(
    type: string,
    sources: {
      concourse?: object;
      turnstile?: object;
      escalator?: object;
    },
    confidenceScores: {
      concourse: number;
      turnstile: number;
      escalator: number;
    },
    time: string,
    linkedAnomalyId?: string
  ): ConflictLog {
    const conflict: ConflictLog = {
      id: `conf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: generateTimestamp(),
      conflictType: type,
      sources,
      confidenceScores,
      resolution: 'pending',
      linkedAnomalyId,
    };

    this.conflictLogs.push(conflict);
    return conflict;
  }

  autoResolve(conflict: ConflictLog): ConflictLog {
    const { concourse, turnstile, escalator } = conflict.confidenceScores;
    const scores = [
      { source: 'concourse', score: concourse },
      { source: 'turnstile', score: turnstile },
      { source: 'escalator', score: escalator },
    ];

    const maxScore = Math.max(...scores.map((s) => s.score));
    const maxSource = scores.find((s) => s.score === maxScore);

    const updatedConflict: ConflictLog = {
      ...conflict,
      resolution: 'auto_resolved',
      resolvedAt: generateTimestamp(),
      notes: `自动采用${maxSource?.source || '未知'}数据源（置信度${maxScore}），数据偏差已记录`,
    };

    this.updateConflict(updatedConflict);
    return updatedConflict;
  }

  manualResolve(
    conflictId: string,
    decision: string,
    operator: string,
    notes: string
  ): ConflictLog | null {
    const conflict = this.conflictLogs.find((c) => c.id === conflictId);
    if (!conflict) return null;

    const updatedConflict: ConflictLog = {
      ...conflict,
      resolution: 'manual_resolved',
      resolvedBy: operator,
      resolvedAt: generateTimestamp(),
      notes: `${decision}。${notes}`,
    };

    this.updateConflict(updatedConflict);
    return updatedConflict;
  }

  private updateConflict(updated: ConflictLog): void {
    const index = this.conflictLogs.findIndex((c) => c.id === updated.id);
    if (index !== -1) {
      this.conflictLogs[index] = updated;
    }
  }

  getConflictLogs(): ConflictLog[] {
    return [...this.conflictLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  getPendingConflicts(): ConflictLog[] {
    return this.conflictLogs.filter((c) => c.resolution === 'pending');
  }

  getResolvedConflicts(): ConflictLog[] {
    return this.conflictLogs.filter((c) => c.resolution !== 'pending');
  }

  getConflictById(id: string): ConflictLog | undefined {
    return this.conflictLogs.find((c) => c.id === id);
  }

  batchAutoResolve(): number {
    let resolvedCount = 0;
    this.getPendingConflicts().forEach((conflict) => {
      const maxConfidence = Math.max(
        conflict.confidenceScores.concourse,
        conflict.confidenceScores.turnstile,
        conflict.confidenceScores.escalator
      );
      if (maxConfidence >= 0.9) {
        this.autoResolve(conflict);
        resolvedCount++;
      }
    });
    return resolvedCount;
  }

  static shouldManualResolve(conflict: ConflictLog): boolean {
    const { concourse, turnstile, escalator } = conflict.confidenceScores;
    const scores = [concourse, turnstile, escalator].filter((s) => s > 0);
    if (scores.length < 2) return false;

    const sorted = [...scores].sort((a, b) => b - a);
    const diff = sorted[0] - sorted[1];
    return diff < 0.1;
  }

  static getConflictTypeName(type: string): string {
    const names: Record<string, string> = {
      passenger_count_mismatch: '客流计数不一致',
      direction_conflict: '方向设置冲突',
      capacity_data_conflict: '容量数据冲突',
      device_status_conflict: '设备状态冲突',
    };
    return names[type] || type;
  }

  static getResolutionStatusName(status: ConflictLog['resolution']): string {
    const names: Record<string, string> = {
      pending: '待处理',
      auto_resolved: '自动解决',
      manual_resolved: '人工解决',
    };
    return names[status] || status;
  }
}
