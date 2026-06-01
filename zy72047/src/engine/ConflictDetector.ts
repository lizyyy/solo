import type { Conflict, Operation, GameRound } from '@/types/game';
import { generateId, getCurrentTimestamp, getOperatorName } from '@/utils/storage';

interface ClassroomScoreEntry {
  roundId: string;
  operationId?: string;
  field: string;
  value: number | string;
  note: string;
  timestamp: string;
  source: string;
}

interface ImportedDataEntry {
  roundId: string;
  operationId?: string;
  field: string;
  value: number | string;
  note: string;
  timestamp: string;
  source: string;
}

export class ConflictDetector {
  private tolerance: number = 0;

  constructor(tolerance: number = 0) {
    this.tolerance = tolerance;
  }

  detectConflicts(
    classroomData: ClassroomScoreEntry[],
    importedData: ImportedDataEntry[]
  ): Conflict[] {
    const conflicts: Conflict[] = [];
    const matchedPairs = new Map<string, { classroom: ClassroomScoreEntry; imported: ImportedDataEntry }>();

    classroomData.forEach(classroomEntry => {
      const key = this.getMatchKey(classroomEntry);
      const importedEntry = importedData.find(imp => this.getMatchKey(imp) === key);
      
      if (importedEntry) {
        matchedPairs.set(key, { classroom: classroomEntry, imported: importedEntry });
      }
    });

    matchedPairs.forEach(({ classroom, imported }) => {
      if (this.isConflict(classroom.value, imported.value)) {
        const conflict = this.createConflict(classroom, imported);
        conflicts.push(conflict);
      }
    });

    return conflicts;
  }

  detectConflictsFromOperations(
    round: GameRound,
    operations: Operation[],
    classroomScores: ClassroomScoreEntry[]
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    classroomScores.forEach(classroomEntry => {
      if (classroomEntry.roundId !== round.id) return;

      let importedValue: number | string | undefined;
      let importedNote = '';
      let importedTimestamp = round.startTime;
      let operationId: string | undefined;

      if (classroomEntry.operationId) {
        const op = operations.find(o => o.id === classroomEntry.operationId);
        if (op) {
          operationId = op.id;
          importedNote = op.note;
          importedTimestamp = op.timestamp;
          
          switch (classroomEntry.field) {
            case 'score':
              importedValue = op.scoreAfter;
              break;
            case 'resources':
              importedValue = op.resourcesAfter;
              break;
            case 'risk':
              importedValue = op.riskAfter;
              break;
            case 'scoreDelta':
              importedValue = op.scoreDelta;
              break;
            case 'resourceDelta':
              importedValue = op.resourceDelta;
              break;
            default:
              importedValue = undefined;
          }
        }
      } else {
        switch (classroomEntry.field) {
          case 'finalScore':
            importedValue = round.finalScore;
            importedTimestamp = round.endTime || round.startTime;
            break;
          case 'finalResources':
            importedValue = round.finalResources;
            importedTimestamp = round.endTime || round.startTime;
            break;
          case 'finalRisk':
            importedValue = round.finalRisk;
            importedTimestamp = round.endTime || round.startTime;
            break;
        }
      }

      if (importedValue !== undefined && this.isConflict(classroomEntry.value, importedValue)) {
        const importedEntry: ImportedDataEntry = {
          roundId: round.id,
          operationId,
          field: classroomEntry.field,
          value: importedValue,
          note: importedNote,
          timestamp: importedTimestamp,
          source: '黑胶节拍修复赛',
        };

        const conflict = this.createConflict(classroomEntry, importedEntry, operationId);
        conflicts.push(conflict);
      }
    });

    return conflicts;
  }

  private getMatchKey(entry: { roundId: string; operationId?: string; field: string }): string {
    return `${entry.roundId}-${entry.operationId || 'round'}-${entry.field}`;
  }

  private isConflict(
    value1: number | string,
    value2: number | string
  ): boolean {
    if (typeof value1 === 'number' && typeof value2 === 'number') {
      return Math.abs(value1 - value2) > this.tolerance;
    }
    return String(value1) !== String(value2);
  }

  private createConflict(
    classroom: ClassroomScoreEntry,
    imported: ImportedDataEntry,
    operationId?: string
  ): Conflict {
    const { suggestedAction, suggestedReason } = this.generateSuggestion(classroom, imported);

    return {
      id: generateId(),
      roundId: classroom.roundId,
      operationId,
      field: classroom.field,
      classroomData: {
        value: classroom.value,
        note: classroom.note,
        source: classroom.source,
        timestamp: classroom.timestamp,
      },
      importedData: {
        value: imported.value,
        note: imported.note,
        source: imported.source,
        timestamp: imported.timestamp,
      },
      status: 'pending',
      resolution: 'pending',
      suggestedAction,
      suggestedReason,
    };
  }

  generateSuggestion(
    classroom: ClassroomScoreEntry,
    imported: ImportedDataEntry
  ): { suggestedAction: string; suggestedReason: string } {
    const classroomTime = new Date(classroom.timestamp).getTime();
    const importedTime = new Date(imported.timestamp).getTime();
    const timeDiff = Math.abs(classroomTime - importedTime);

    const hasClassroomNote = classroom.note && classroom.note.trim().length > 0;
    const hasImportedNote = imported.note && imported.note.trim().length > 0;

    if (hasClassroomNote && !hasImportedNote) {
      return {
        suggestedAction: '建议采信课堂计分表数据',
        suggestedReason: '课堂计分表有手写备注说明，导入数据无特殊说明。有备注的数据优先级更高。',
      };
    }

    if (!hasClassroomNote && hasImportedNote) {
      return {
        suggestedAction: '建议采信导入数据',
        suggestedReason: '导入数据有系统备注说明，课堂计分表无特殊说明。有备注的数据优先级更高。',
      };
    }

    if (hasClassroomNote && hasImportedNote) {
      return {
        suggestedAction: '建议人工核实两边备注后裁决',
        suggestedReason: '两边都有备注说明，请仔细核对备注内容后再做决定。不要轻易覆盖任何一方的记录。',
      };
    }

    if (timeDiff < 60000) {
      return {
        suggestedAction: '建议采信导入数据',
        suggestedReason: '导入数据为系统自动记录，时间更精确，且与课堂记录时间接近（1分钟内）。',
      };
    }

    return {
      suggestedAction: '建议人工核实后裁决',
      suggestedReason: '两边数据都没有特殊备注，时间差异较大，请与原始记录核对后再做决定。',
    };
  }

  resolveConflict(
    conflict: Conflict,
    resolution: 'classroom' | 'imported' | 'pending',
    reason: string
  ): Conflict {
    return {
      ...conflict,
      status: resolution === 'pending' ? 'pending' : 'resolved',
      resolution,
      resolvedBy: getOperatorName(),
      resolvedAt: getCurrentTimestamp(),
      suggestedAction: conflict.suggestedAction,
      suggestedReason: reason || conflict.suggestedReason,
    };
  }

  static compareOperations(
    op1: Operation,
    op2: Operation,
    fields: Array<'scoreDelta' | 'resourceDelta' | 'riskDelta' | 'scoreAfter' | 'resourcesAfter' | 'riskAfter'> = ['scoreAfter', 'resourcesAfter', 'riskAfter']
  ): Array<{ field: string; value1: number; value2: number; diff: number }> {
    const differences: Array<{ field: string; value1: number; value2: number; diff: number }> = [];

    fields.forEach(field => {
      const v1 = op1[field];
      const v2 = op2[field];
      const diff = v1 - v2;
      
      if (diff !== 0) {
        differences.push({ field, value1: v1, value2: v2, diff });
      }
    });

    return differences;
  }
}
