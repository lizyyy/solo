import {
  Obstruction,
  ProcessStage,
  RangefinderRecord,
  DisplayMode,
  ImportSummary,
  HistoryRecord,
  UserFriendlyError,
  ConflictResolution
} from '../types';
import {
  createImportSession,
  batchImportCADLayers,
  RawCADLayer,
  reimportSameLayers
} from './CADImporter';
import {
  detectConflicts,
  resolveConflict,
  requiresReview,
  explainConflict,
  markAsDuplicate,
  ConflictDetectionResult
} from './BoundaryRules';
import { HistoryTracker } from './HistoryTracker';
import { DisplayService } from './DisplayService';
import { createRangefinderRecord, validateRangefinderRecord } from '../models/RangefinderModel';
import { addRangefinderRecord, updateStatus } from '../models/ObstructionModel';
import { ErrorCollector, createError, ErrorCode } from './ErrorHandler';
import { ObstructionStatus } from '../types';

export interface ProcessState {
  currentStage: ProcessStage;
  obstructions: Obstruction[];
  pendingConflicts: ConflictDetectionResult | null;
  lastAction: string | null;
  lastOperator: string | null;
  stageHistory: Array<{ stage: ProcessStage; timestamp: number; operator: string }>;
}

export interface StageResult<T = unknown> {
  success: boolean;
  data?: T;
  errors: UserFriendlyError[];
  warnings: string[];
  nextStage?: ProcessStage;
  requiresReview?: boolean;
  reviewItems?: Array<{
    obstructionId: string;
    conflictType: string;
    description: string;
    conflictingNames: string[];
  }>;
}

export class ProcessOrchestrator {
  private state: ProcessState;
  private historyTracker: HistoryTracker;
  private displayService: DisplayService;
  private errorCollector: ErrorCollector;

  constructor() {
    this.state = {
      currentStage: ProcessStage.CAD_IMPORT,
      obstructions: [],
      pendingConflicts: null,
      lastAction: null,
      lastOperator: null,
      stageHistory: []
    };
    this.historyTracker = new HistoryTracker();
    this.displayService = new DisplayService();
    this.errorCollector = new ErrorCollector();
  }

  getState(): ProcessState {
    return { ...this.state };
  }

  getHistoryTracker(): HistoryTracker {
    return this.historyTracker;
  }

  getDisplayService(): DisplayService {
    return this.displayService;
  }

  getErrorCollector(): ErrorCollector {
    return this.errorCollector;
  }

  async step1_importCADLayers(
    rawLayers: RawCADLayer[],
    operator: string,
    source: string,
    isReimport = false
  ): Promise<StageResult<{
    summary: ImportSummary;
    obstructions: Obstruction[];
    conflictCount: number;
  }>> {
    if (this.state.currentStage !== ProcessStage.CAD_IMPORT && !isReimport) {
      this.errorCollector.addError('INVALID_OPERATION', {
        currentStage: this.translateStage(this.state.currentStage),
        operation: '导入CAD图层'
      });
      return this.createResult(false);
    }

    this.errorCollector.clear();

    if (rawLayers.length === 0) {
      this.errorCollector.addError('VALIDATION_ERROR', {
        errors: '至少需要导入一个CAD图层'
      });
      return this.createResult(false);
    }

    let importResult;
    if (isReimport) {
      importResult = reimportSameLayers(
        rawLayers,
        this.state.obstructions,
        operator,
        source
      );
    } else {
      const session = createImportSession(source, operator, this.state.obstructions);
      importResult = batchImportCADLayers(rawLayers, session, false);
    }

    for (const obs of importResult.obstructions) {
      const existing = this.state.obstructions.find(o => o.id === obs.id);
      if (existing) {
        this.historyTracker.trackObstructionUpdate(existing, obs, operator, 'CAD图层导入更新');
      } else {
        this.historyTracker.trackChange({
          entityType: 'obstruction',
          entityId: obs.id,
          action: 'import',
          oldValue: null,
          newValue: obs,
          operator,
          notes: '从CAD图层导入'
        });
      }
    }

    this.state.obstructions = importResult.obstructions;

    const conflictResult = detectConflicts(this.state.obstructions, operator);
    this.state.obstructions = conflictResult.updated.map(obs => {
      if (!obs.conflictInfo && obs.status === ObstructionStatus.PENDING_REVIEW) {
        return updateStatus(obs, ObstructionStatus.CONFIRMED, operator);
      }
      return obs;
    });
    this.state.pendingConflicts = conflictResult.result;

    if (conflictResult.result.hasConflict) {
      for (const conflict of conflictResult.result.conflicts) {
        const obs1 = this.state.obstructions.find(o => o.id === conflict.obstructionIds[0]);
        const obs2 = this.state.obstructions.find(o => o.id === conflict.obstructionIds[1]);

        if (obs1 && obs2) {
          const names1 = obs1.aliases.map(a => a.name);
          const names2 = obs2.aliases.map(a => a.name);

          this.errorCollector.addError('CONFLICT_DETECTED', {
            name1: names1[0] || '未命名',
            id1: obs1.id,
            name2: names2[0] || '未命名',
            id2: obs2.id
          });
        }
      }
    }

    this.recordStageTransition(ProcessStage.CAD_IMPORT, operator);
    this.state.lastAction = 'CAD图层导入';
    this.state.lastOperator = operator;

    this.displayService.setObstructions(this.state.obstructions.filter(o => o.status !== ObstructionStatus.DUPLICATE));

    const hasConflicts = conflictResult.result.hasConflict;

    return this.createResult(true, {
      summary: importResult.summary,
      obstructions: this.state.obstructions,
      conflictCount: conflictResult.result.conflicts.length
    }, {
      nextStage: ProcessStage.RANGEFINDER_SUPPLEMENT,
      requiresReview: hasConflicts,
      reviewItems: hasConflicts ? conflictResult.result.conflicts.map(c => {
        const obs = this.state.obstructions.find(o => o.id === c.obstructionIds[0]);
        return {
          obstructionId: c.obstructionIds[0],
          conflictType: c.type,
          description: explainConflict(obs?.conflictInfo!),
          conflictingNames: obs?.aliases.map(a => a.name) || []
        };
      }) : undefined
    });
  }

  async step2_supplementRangefinder(
    records: Array<{
      obstructionId: string;
      measuredBy: string;
      distance: number;
      fromPoint: { x: number; y: number; z: number };
      toPoint: { x: number; y: number; z: number };
      notes?: string;
      accuracy?: number;
    }>,
    operator: string
  ): Promise<StageResult<{
    updatedObstructions: Obstruction[];
    validRecords: number;
    invalidRecords: number;
  }>> {
    if (this.state.currentStage !== ProcessStage.RANGEFINDER_SUPPLEMENT &&
        this.state.currentStage !== ProcessStage.CAD_IMPORT) {
      this.errorCollector.addError('INVALID_OPERATION', {
        currentStage: this.translateStage(this.state.currentStage),
        operation: '补充测距仪记录'
      });
      return this.createResult(false);
    }

    this.errorCollector.clear();

    if (this.state.obstructions.length === 0) {
      this.errorCollector.addError('MISSING_CAD_DATA', {
        operation: '补充测距仪记录'
      });
      return this.createResult(false);
    }

    let validCount = 0;
    let invalidCount = 0;
    const updatedIds = new Set<string>();

    for (const recordData of records) {
      const obstruction = this.state.obstructions.find(o => o.id === recordData.obstructionId);

      if (!obstruction) {
        this.errorCollector.addError('NOT_FOUND', {
          type: '障碍物',
          id: recordData.obstructionId
        });
        invalidCount++;
        continue;
      }

      const rawRecord = createRangefinderRecord(recordData);
      const validation = validateRangefinderRecord(rawRecord);

      if (!validation.valid) {
        this.errorCollector.addError('INVALID_RANGEFINDER', {
          diff: Math.abs(rawRecord.distance - this.calculateDistance(rawRecord.fromPoint, rawRecord.toPoint)),
          tolerance: rawRecord.accuracy ?? 0.01,
          errors: validation.errors.join('; ')
        });
        invalidCount++;
        continue;
      }

      const oldObstruction = { ...obstruction };
      const updated = addRangefinderRecord(obstruction, rawRecord);

      this.historyTracker.trackChange({
        entityType: 'rangefinder',
        entityId: rawRecord.id,
        action: 'create',
        oldValue: null,
        newValue: rawRecord,
        operator,
        notes: recordData.notes || '补充测距仪数据'
      });

      this.historyTracker.trackObstructionUpdate(
        oldObstruction,
        updated,
        operator,
        `添加测距仪记录: ${rawRecord.distance}m`
      );

      const index = this.state.obstructions.findIndex(o => o.id === obstruction.id);
      this.state.obstructions[index] = updated;
      updatedIds.add(obstruction.id);
      validCount++;
    }

    const pendingReview = this.state.obstructions.filter(o => requiresReview(o));
    const warnings: string[] = [];

    if (pendingReview.length > 0) {
      warnings.push(`仍有${pendingReview.length}个障碍物存在名称冲突，需要培训学员复核后才能进入下一步`);
    }

    this.recordStageTransition(ProcessStage.RANGEFINDER_SUPPLEMENT, operator);
    this.state.lastAction = '补充测距仪记录';
    this.state.lastOperator = operator;

    const updatedObstructions = this.state.obstructions.filter(o => updatedIds.has(o.id));
    const hasErrors = this.errorCollector.hasErrors();

    this.displayService.setObstructions(
      this.state.obstructions.filter(o => o.status !== ObstructionStatus.DUPLICATE)
    );

    return this.createResult(!hasErrors, {
      updatedObstructions,
      validRecords: validCount,
      invalidRecords: invalidCount
    }, {
      nextStage: pendingReview.length === 0 && !hasErrors ? ProcessStage.VIEW_3D_UPDATE : undefined,
      requiresReview: pendingReview.length > 0,
      reviewItems: pendingReview.map(o => ({
        obstructionId: o.id,
        conflictType: o.conflictInfo?.conflictType || 'unknown',
        description: o.conflictInfo ? explainConflict(o.conflictInfo) : '待复核',
        conflictingNames: o.aliases.map(a => a.name)
      }))
    }, warnings);
  }

  async step3_update3DView(
    displayMode: DisplayMode,
    operator: string
  ): Promise<StageResult<{
    displayItems: unknown[];
    chartData?: unknown;
    itemCount: number;
    itemsWithConflicts: number;
  }>> {
    this.errorCollector.clear();

    if (this.state.currentStage !== ProcessStage.VIEW_3D_UPDATE) {
      this.errorCollector.addError('INVALID_OPERATION', {
        currentStage: this.translateStage(this.state.currentStage),
        operation: '更新三维视图'
      });
      return this.createResult(false);
    }

    const pendingReview = this.state.obstructions.filter(o => requiresReview(o));
    if (pendingReview.length > 0) {
      this.errorCollector.addError('INVALID_OPERATION', {
        currentStatus: '存在待复核冲突',
        operation: '更新三维视图'
      });
      return this.createResult(false);
    }

    this.displayService.setObstructions(this.state.obstructions.filter(o => o.status !== ObstructionStatus.DUPLICATE));
    this.displayService.setDisplayMode(displayMode);

    let displayItems: unknown[];
    let chartData: unknown | undefined;

    if (displayMode === DisplayMode.VIEW_3D) {
      displayItems = this.displayService.render3D();
    } else if (displayMode === DisplayMode.CHART) {
      chartData = this.displayService.renderChart();
      displayItems = (chartData as { dataPoints: unknown[] }).dataPoints;
    } else {
      displayItems = this.state.obstructions;
    }

    const itemsWithConflicts = this.state.obstructions.filter(o => o.conflictInfo).length;

    this.recordStageTransition(ProcessStage.VIEW_3D_UPDATE, operator);
    this.state.currentStage = ProcessStage.COMPLETED;
    this.state.lastAction = `更新${this.translateDisplayMode(displayMode)}视图`;
    this.state.lastOperator = operator;

    return this.createResult(true, {
      displayItems,
      chartData,
      itemCount: displayItems.length,
      itemsWithConflicts
    }, {
      nextStage: ProcessStage.COMPLETED
    });
  }

  async resolvePendingConflict(
    primaryId: string,
    secondaryId: string,
    resolution: ConflictResolution,
    operator: string,
    canonicalName?: string
  ): Promise<StageResult<{
    primary: Obstruction;
    secondary: Obstruction;
    merged: boolean;
  }>> {
    const primary = this.state.obstructions.find(o => o.id === primaryId);
    const secondary = this.state.obstructions.find(o => o.id === secondaryId);

    if (!primary || !secondary) {
      this.errorCollector.addError('NOT_FOUND', {
        type: '障碍物',
        id: !primary ? primaryId : secondaryId
      });
      return this.createResult(false);
    }

    if (!primary.conflictInfo || !secondary.conflictInfo) {
      this.errorCollector.addError('INVALID_OPERATION', {
        currentStatus: '无冲突',
        operation: '解决冲突'
      });
      return this.createResult(false);
    }

    this.historyTracker.saveSnapshot(primary.id, primary);
    this.historyTracker.saveSnapshot(secondary.id, secondary);

    const mergeResult = resolveConflict(primary, secondary, resolution, operator, canonicalName);

    const primaryIndex = this.state.obstructions.findIndex(o => o.id === primaryId);
    this.state.obstructions[primaryIndex] = mergeResult.primary;

    let secondaryUpdated = secondary;
    if (resolution !== ConflictResolution.MANUAL) {
      secondaryUpdated = markAsDuplicate(secondary, primaryId, operator);
    } else {
      secondaryUpdated = {
        ...secondary,
        conflictInfo: {
          ...secondary.conflictInfo!,
          resolution: ConflictResolution.MANUAL,
          resolvedAt: Date.now(),
          resolvedBy: operator,
          resolutionNotes: '标记为待人工复核，暂不处理'
        }
      };
    }
    const secondaryIndex = this.state.obstructions.findIndex(o => o.id === secondaryId);
    this.state.obstructions[secondaryIndex] = secondaryUpdated;

    this.historyTracker.trackChange({
      entityType: 'obstruction',
      entityId: primaryId,
      action: 'merge',
      fieldName: 'conflictInfo',
      oldValue: primary.conflictInfo,
      newValue: mergeResult.primary.conflictInfo,
      operator,
      notes: `与${secondaryId}合并，方式: ${resolution}`
    });

    this.historyTracker.trackChange({
      entityType: 'obstruction',
      entityId: secondaryId,
      action: 'update',
      fieldName: 'status',
      oldValue: secondary.status,
      newValue: ObstructionStatus.DUPLICATE,
      operator,
      notes: `标记为${primaryId}的重复数据`
    });

    this.refreshPendingConflicts(operator);

    return this.createResult(true, {
      primary: mergeResult.primary,
      secondary: secondaryUpdated,
      merged: resolution === ConflictResolution.MERGE
    });
  }

  async updateObstructionNotes(
    obstructionId: string,
    notes: string,
    operator: string
  ): Promise<StageResult<{
    obstruction: Obstruction;
    history: HistoryRecord[];
  }>> {
    const obstruction = this.state.obstructions.find(o => o.id === obstructionId);

    if (!obstruction) {
      this.errorCollector.addError('NOT_FOUND', {
        type: '障碍物',
        id: obstructionId
      });
      return this.createResult(false);
    }

    const oldNotes = obstruction.notes;
    const updated = updateStatus(obstruction, obstruction.status, operator, notes);

    const history = this.historyTracker.trackObstructionUpdate(
      obstruction,
      updated,
      operator,
      '更新备注'
    );

    const index = this.state.obstructions.findIndex(o => o.id === obstructionId);
    this.state.obstructions[index] = updated;

    return this.createResult(true, {
      obstruction: updated,
      history
    });
  }

  async selectItemForReview(
    itemId: string,
    itemType: 'obstruction' | 'route'
  ): Promise<StageResult<{
    detail: unknown;
    sourceTrace: unknown;
    canResolve: boolean;
  }>> {
    const detail = this.displayService.getSelectionDetail(itemId, itemType);

    if (!detail) {
      this.errorCollector.addError('NOT_FOUND', {
        type: itemType === 'obstruction' ? '障碍物' : '路线',
        id: itemId
      });
      return this.createResult(false);
    }

    const sourceTrace = this.displayService.getSourceTrace(itemId);

    return this.createResult(true, {
      detail,
      sourceTrace,
      canResolve: detail.canResolve
    });
  }

  getObstructionHistory(obstructionId: string): Array<HistoryRecord & { diffDescription: string }> {
    return this.historyTracker.getHistoryWithDiff(obstructionId);
  }

  getPendingConflicts(): ConflictDetectionResult | null {
    return this.state.pendingConflicts;
  }

  canProceedToNextStage(): boolean {
    const pendingReview = this.state.obstructions.filter(o => requiresReview(o));
    return pendingReview.length === 0;
  }

  private refreshPendingConflicts(operator: string): void {
    const result = detectConflicts(this.state.obstructions, operator);
    this.state.obstructions = result.updated.map(obs => {
      if (!obs.conflictInfo && obs.status === ObstructionStatus.PENDING_REVIEW) {
        return updateStatus(obs, ObstructionStatus.CONFIRMED, operator);
      }
      return obs;
    });
    this.state.pendingConflicts = result.result;

    this.displayService.setObstructions(
      this.state.obstructions.filter(o => o.status !== ObstructionStatus.DUPLICATE)
    );
  }

  private recordStageTransition(stage: ProcessStage, operator: string): void {
    const lastEntry = this.state.stageHistory[this.state.stageHistory.length - 1];
    if (lastEntry && lastEntry.stage === stage) {
      return;
    }
    this.state.stageHistory.push({
      stage,
      timestamp: Date.now(),
      operator
    });
  }

  private translateStage(stage: ProcessStage): string {
    const translations: Record<ProcessStage, string> = {
      [ProcessStage.CAD_IMPORT]: 'CAD图层导入',
      [ProcessStage.RANGEFINDER_SUPPLEMENT]: '测距仪数据补录',
      [ProcessStage.VIEW_3D_UPDATE]: '三维视图更新',
      [ProcessStage.COMPLETED]: '已完成'
    };
    return translations[stage] || stage;
  }

  private translateDisplayMode(mode: DisplayMode): string {
    const translations: Record<DisplayMode, string> = {
      [DisplayMode.VIEW_3D]: '三维',
      [DisplayMode.CHART]: '图表',
      [DisplayMode.LIST]: '列表'
    };
    return translations[mode] || mode;
  }

  private calculateDistance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private createResult<T>(
    success: boolean,
    data?: T,
    meta: {
      nextStage?: ProcessStage;
      requiresReview?: boolean;
      reviewItems?: Array<{
        obstructionId: string;
        conflictType: string;
        description: string;
        conflictingNames: string[];
      }>;
    } = {},
    warnings: string[] = []
  ): StageResult<T> {
    const errors = this.errorCollector.formatAll();
    const rawErrors = this.errorCollector.getAll();

    if (success && meta.nextStage) {
      this.state.currentStage = meta.nextStage;
    }

    return {
      success,
      data,
      errors: rawErrors,
      warnings,
      ...meta
    };
  }
}
