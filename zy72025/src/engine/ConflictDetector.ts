import type {
  Conflict,
  ConflictType,
  ConflictEvidence,
  SuggestedAction,
  GameSession,
  PlayerRecord,
  PlayerStep,
  GameStep,
  Resources,
} from '@/types';
import { generateId, compareResources, deepClone } from '@/utils/helpers';
import { LocalStorage } from '@/storage/LocalStorage';

export class ConflictDetector {
  static detectConflicts(
    session: GameSession,
    importedRecord: PlayerRecord
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    conflicts.push(...this.detectNullValues(session, importedRecord));
    conflicts.push(...this.detectDuplicateSteps(importedRecord));
    conflicts.push(...this.detectBoundaryIssues(session, importedRecord));
    conflicts.push(...this.detectStepMismatches(session, importedRecord));
    conflicts.push(...this.detectResourceMismatches(session, importedRecord));
    conflicts.push(...this.detectTimelineConflicts(session, importedRecord));

    return conflicts.map((conflict) => ({
      ...conflict,
      evidence: this.generateEvidence(conflict),
      suggestedActions: this.suggestActions(conflict),
    }));
  }

  private static detectNullValues(
    session: GameSession,
    importedRecord: PlayerRecord
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    importedRecord.steps.forEach((step, index) => {
      const hasNullDecision = step.decision === null || step.decision === undefined || step.decision === '';
      const hasNullResources = step.resources !== undefined && Object.values(step.resources).some((v) => v === null || v === undefined);

      if (hasNullDecision || hasNullResources) {
        conflicts.push({
          id: generateId(),
          sessionId: session.id,
          type: 'null_value',
          stepIndex: index,
          studentRecord: step,
          importedData: importedRecord,
          evidence: [],
          suggestedActions: [],
        });
      }
    });

    if (!importedRecord.playerName || importedRecord.playerName.trim() === '') {
      conflicts.push({
        id: generateId(),
        sessionId: session.id,
        type: 'null_value',
        studentRecord: { playerName: importedRecord.playerName },
        importedData: { expectedPlayerName: session.playerName },
        evidence: [],
        suggestedActions: [],
      });
    }

    return conflicts;
  }

  private static detectDuplicateSteps(importedRecord: PlayerRecord): Conflict[] {
    const conflicts: Conflict[] = [];
    const stepIndexes = new Map<number, PlayerStep[]>();

    importedRecord.steps.forEach((step) => {
      if (!stepIndexes.has(step.stepIndex)) {
        stepIndexes.set(step.stepIndex, []);
      }
      stepIndexes.get(step.stepIndex)!.push(step);
    });

    stepIndexes.forEach((steps, index) => {
      if (steps.length > 1) {
        conflicts.push({
          id: generateId(),
          sessionId: '',
          type: 'duplicate_step',
          stepIndex: index,
          studentRecord: steps,
          importedData: { count: steps.length },
          evidence: [],
          suggestedActions: [],
        });
      }
    });

    return conflicts;
  }

  private static detectBoundaryIssues(
    session: GameSession,
    importedRecord: PlayerRecord
  ): Conflict[] {
    const conflicts: Conflict[] = [];
    const level = LocalStorage.getLevel(session.levelId);

    if (!level) return conflicts;

    importedRecord.steps.forEach((step, index) => {
      if (step.resources) {
        const boundaryIssues: string[] = [];

        Object.entries(step.resources).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          
          if (value < -100 || value > 100) {
            boundaryIssues.push(`${key}: ${value} 超出正常范围 [-100, 100]`);
          }
        });

        if (boundaryIssues.length > 0) {
          conflicts.push({
            id: generateId(),
            sessionId: session.id,
            type: 'boundary_issue',
            stepIndex: index,
            studentRecord: step,
            importedData: { issues: boundaryIssues },
            evidence: [],
            suggestedActions: [],
          });
        }
      }
    });

    return conflicts;
  }

  private static detectStepMismatches(
    session: GameSession,
    importedRecord: PlayerRecord
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    const sessionSteps = session.stepHistory.filter((s) => !s.isSupplement);
    const recordSteps = importedRecord.steps;

    if (sessionSteps.length !== recordSteps.length) {
      conflicts.push({
        id: generateId(),
        sessionId: session.id,
        type: 'step_missing',
        studentRecord: { stepCount: recordSteps.length },
        importedData: { stepCount: sessionSteps.length },
        evidence: [],
        suggestedActions: [],
      });
    }

    return conflicts;
  }

  private static detectResourceMismatches(
    session: GameSession,
    importedRecord: PlayerRecord
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    session.stepHistory.forEach((sessionStep, index) => {
      const recordStep = importedRecord.steps[index];
      
      if (recordStep?.resources && !sessionStep.isSupplement) {
        const { isEqual, differences } = compareResources(
          sessionStep.resourcesAfter,
          recordStep.resources as Resources
        );

        if (!isEqual) {
          conflicts.push({
            id: generateId(),
            sessionId: session.id,
            type: 'resource_mismatch',
            stepIndex: index,
            studentRecord: {
              step: recordStep,
              resources: recordStep.resources,
            },
            importedData: {
              step: sessionStep,
              resources: sessionStep.resourcesAfter,
              differences,
            },
            evidence: [],
            suggestedActions: [],
          });
        }
      }
    });

    return conflicts;
  }

  private static detectTimelineConflicts(
    session: GameSession,
    importedRecord: PlayerRecord
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    importedRecord.steps.forEach((step, index) => {
      if (step.timestamp && index > 0) {
        const prevStep = importedRecord.steps[index - 1];
        if (prevStep?.timestamp) {
          const currentTime = new Date(step.timestamp).getTime();
          const prevTime = new Date(prevStep.timestamp).getTime();
          
          if (currentTime < prevTime) {
            conflicts.push({
              id: generateId(),
              sessionId: session.id,
              type: 'timeline_conflict',
              stepIndex: index,
              studentRecord: {
                currentStep: step,
                previousStep: prevStep,
              },
              importedData: {
                message: '时间戳顺序异常',
              },
              evidence: [],
              suggestedActions: [],
            });
          }
        }
      }
    });

    return conflicts;
  }

  static generateEvidence(conflict: Conflict): ConflictEvidence[] {
    const evidence: ConflictEvidence[] = [];

    switch (conflict.type) {
      case 'resource_mismatch':
        evidence.push({
          source: 'student',
          description: '学生记录中的资源数据',
          data: conflict.studentRecord.resources,
        });
        evidence.push({
          source: 'imported',
          description: '系统计算的资源数据',
          data: conflict.importedData.resources,
        });
        evidence.push({
          source: 'system',
          description: '差异详情',
          data: conflict.importedData.differences,
        });
        break;

      case 'step_missing':
        evidence.push({
          source: 'student',
          description: '学生记录的步骤数量',
          data: conflict.studentRecord.stepCount,
        });
        evidence.push({
          source: 'imported',
          description: '系统记录的步骤数量',
          data: conflict.importedData.stepCount,
        });
        break;

      case 'timeline_conflict':
        evidence.push({
          source: 'student',
          description: '当前步骤时间戳',
          data: conflict.studentRecord.currentStep?.timestamp,
        });
        evidence.push({
          source: 'student',
          description: '上一步骤时间戳',
          data: conflict.studentRecord.previousStep?.timestamp,
        });
        evidence.push({
          source: 'system',
          description: '问题说明',
          data: conflict.importedData.message,
        });
        break;

      case 'duplicate_step':
        evidence.push({
          source: 'student',
          description: '重复的步骤数据',
          data: conflict.studentRecord,
        });
        evidence.push({
          source: 'system',
          description: '重复次数',
          data: conflict.importedData.count,
        });
        break;

      case 'null_value':
        evidence.push({
          source: 'student',
          description: '包含空值的记录',
          data: conflict.studentRecord,
        });
        evidence.push({
          source: 'system',
          description: '预期格式',
          data: conflict.importedData,
        });
        break;

      case 'boundary_issue':
        evidence.push({
          source: 'student',
          description: '超出边界的资源数据',
          data: conflict.studentRecord.resources,
        });
        evidence.push({
          source: 'system',
          description: '边界问题详情',
          data: conflict.importedData.issues,
        });
        break;
    }

    return evidence;
  }

  static suggestActions(conflict: Conflict): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    switch (conflict.type) {
      case 'resource_mismatch':
        actions.push({
          id: 'use_student',
          label: '使用学生记录',
          description: '以学生手写记录为准，覆盖系统计算值',
          consequence: '系统将更新该步骤的资源数据，可能影响后续步骤和最终评分',
        });
        actions.push({
          id: 'use_imported',
          label: '使用系统数据',
          description: '以系统计算结果为准，保留原始数据',
          consequence: '学生记录中的数据将被标记为参考，不影响游戏结果',
        });
        actions.push({
          id: 'flag_for_review',
          label: '标记待复核',
          description: '暂不处理，标记为需要老师人工复核',
          consequence: '该冲突将保持未解决状态，提醒后续处理',
        });
        break;

      case 'step_missing':
        actions.push({
          id: 'use_student',
          label: '补充缺失步骤',
          description: '根据学生记录补充系统中缺失的步骤',
          consequence: '系统将尝试重建完整的游戏过程',
        });
        actions.push({
          id: 'use_imported',
          label: '保留现有步骤',
          description: '以系统现有步骤为准，忽略额外记录',
          consequence: '学生记录中的额外步骤将作为备注保存',
        });
        actions.push({
          id: 'skip',
          label: '跳过此冲突',
          description: '不做处理，继续后续操作',
          consequence: '步骤数量差异将被记录，但不影响其他数据',
        });
        break;

      case 'timeline_conflict':
        actions.push({
          id: 'use_imported',
          label: '使用系统时间',
          description: '忽略学生记录的时间戳，使用系统记录的时间',
          consequence: '时间顺序将由系统保证，但原始记录会保留',
        });
        actions.push({
          id: 'manual',
          label: '手动调整时间',
          description: '由老师手动修正时间戳顺序',
          consequence: '需要人工介入调整数据',
        });
        actions.push({
          id: 'skip',
          label: '跳过此冲突',
          description: '忽略时间顺序问题',
          consequence: '时间线可能显示异常，但不影响核心数据',
        });
        break;

      case 'duplicate_step':
        actions.push({
          id: 'use_student',
          label: '合并重复项',
          description: '尝试合并重复步骤的信息',
          consequence: '系统将尝试智能合并，保留有效信息',
        });
        actions.push({
          id: 'use_imported',
          label: '保留首条记录',
          description: '只保留第一条记录，删除重复项',
          consequence: '后续重复记录将被忽略',
        });
        actions.push({
          id: 'flag_for_review',
          label: '标记待复核',
          description: '需要老师确认哪条记录是正确的',
          consequence: '冲突将保持未解决状态',
        });
        break;

      case 'null_value':
        actions.push({
          id: 'use_imported',
          label: '使用系统填充',
          description: '使用系统计算值填充空值',
          consequence: '空值将被系统数据替代',
        });
        actions.push({
          id: 'flag_for_review',
          label: '标记待补全',
          description: '标记为空值，需要补充信息',
          consequence: '数据将保持不完整，等待补全',
        });
        actions.push({
          id: 'skip',
          label: '跳过此项',
          description: '忽略空值，继续处理',
          consequence: '可能导致后续数据异常',
        });
        break;

      case 'boundary_issue':
        actions.push({
          id: 'use_student',
          label: '保留原始数据',
          description: '即使超出边界也保留学生记录的数值',
          consequence: '可能出现不合逻辑的数据，但保持记录完整性',
        });
        actions.push({
          id: 'use_imported',
          label: '裁剪到边界内',
          description: '将数值限制在合理范围内',
          consequence: '数据将被修正，但可能与原始记录有偏差',
        });
        actions.push({
          id: 'flag_for_review',
          label: '标记待复核',
          description: '需要老师确认数值是否正确',
          consequence: '冲突将保持未解决状态',
        });
        break;
    }

    return actions;
  }

  static applyResolution(
    session: GameSession,
    conflict: Conflict,
    resolution: 'use_student' | 'use_imported' | 'manual' | 'skip' | 'flag_for_review',
    resolvedBy: string,
    notes?: string
  ): GameSession {
    const updatedSession = deepClone(session);
    const updatedConflict = updatedSession.conflicts.find((c) => c.id === conflict.id);

    if (updatedConflict) {
      updatedConflict.resolution = resolution;
      updatedConflict.resolvedAt = new Date().toISOString();
      updatedConflict.resolvedBy = resolvedBy;
      updatedConflict.resolutionNotes = notes;
    }

    if (resolution === 'use_student' && conflict.stepIndex !== undefined) {
      const step = updatedSession.stepHistory[conflict.stepIndex];
      if (step && conflict.type === 'resource_mismatch') {
        step.resourcesAfter = { ...conflict.studentRecord.resources };
      }
    }

    LocalStorage.saveSession(updatedSession);
    return updatedSession;
  }

  static getConflictTypeLabel(type: ConflictType): string {
    const labels: Record<ConflictType, string> = {
      resource_mismatch: '资源数据不一致',
      step_missing: '步骤数量不匹配',
      timeline_conflict: '时间线冲突',
      duplicate_step: '重复步骤',
      null_value: '空值问题',
      boundary_issue: '边界值异常',
    };
    return labels[type] || type;
  }

  static getConflictSeverity(type: ConflictType): 'high' | 'medium' | 'low' {
    const severity: Record<ConflictType, 'high' | 'medium' | 'low'> = {
      resource_mismatch: 'high',
      step_missing: 'high',
      boundary_issue: 'medium',
      duplicate_step: 'medium',
      null_value: 'medium',
      timeline_conflict: 'low',
    };
    return severity[type] || 'medium';
  }

  static getUnresolvedConflicts(session: GameSession): Conflict[] {
    return session.conflicts.filter((c) => !c.resolution);
  }

  static hasUnresolvedConflicts(session: GameSession): boolean {
    return session.conflicts.some((c) => !c.resolution);
  }

  static getConflictCountByType(session: GameSession): Record<ConflictType, number> {
    const counts: Record<ConflictType, number> = {
      resource_mismatch: 0,
      step_missing: 0,
      timeline_conflict: 0,
      duplicate_step: 0,
      null_value: 0,
      boundary_issue: 0,
    };

    session.conflicts.forEach((c) => {
      counts[c.type]++;
    });

    return counts;
  }
}
