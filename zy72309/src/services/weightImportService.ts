import { parse } from 'csv-parse/sync';
import systemStore from '../store/systemStore';
import { generateId, generateBatchNumber } from '../utils/idGenerator';
import { createAuditLog, appendChangeHistory } from '../utils/auditTrail';
import formulaScreenshotService from './formulaScreenshotService';
import {
  ScoringWeightItem,
  ImportBatch,
  DataSource,
  ConflictRecord,
  ConflictType,
  ConflictStatus,
  ConflictEvidence,
  AuditAction
} from '../types';

interface WeightImportRow {
  criterionId: string;
  criterionName: string;
  weight: string;
  maxScore: string;
  formula?: string;
}

export class WeightImportService {
  public importWeightTable(
    csvContent: string,
    importedBy: string,
    importRemarks?: string
  ): {
    batch: ImportBatch;
    weights: ScoringWeightItem[];
    conflicts: ConflictRecord[];
  } {
    const records = this.parseCsv(csvContent);
    const batchId = generateId();
    const batchNumber = generateBatchNumber('WEIGHT');

    const batch: ImportBatch = {
      id: batchId,
      batchNumber,
      importedBy,
      importedAt: new Date(),
      sourceType: 'weight_table',
      recordCount: records.length,
      isProcessed: true,
      remarks: importRemarks
    };

    const weights: ScoringWeightItem[] = records.map((row) => ({
      id: generateId(),
      criterionId: row.criterionId,
      criterionName: row.criterionName,
      weight: parseFloat(row.weight),
      maxScore: parseFloat(row.maxScore),
      formula: row.formula,
      originalFormula: row.formula,
      source: DataSource.WEIGHT_TABLE,
      importBatchId: batchId,
      createdAt: new Date(),
      updatedAt: new Date(),
      changeHistory: []
    }));

    systemStore.addWeightBatch(batch);
    systemStore.addScoringWeights(weights);

    createAuditLog(
      'weight',
      batchId,
      AuditAction.IMPORT,
      importedBy,
      `导入评分权重表: ${batchNumber}，共 ${weights.length} 条标准${importRemarks ? `，备注: ${importRemarks}` : ''}`,
      []
    );

    const conflicts = this.detectConflicts(weights, batchId, importedBy);

    const keyNoteConflicts = formulaScreenshotService.buildWeightConflictsFromKeyNotes(
      batchId,
      weights,
      importedBy
    );

    return {
      batch,
      weights,
      conflicts: [...conflicts, ...keyNoteConflicts]
    };
  }

  private parseCsv(csvContent: string): WeightImportRow[] {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    return records as WeightImportRow[];
  }

  private detectConflicts(
    newWeights: ScoringWeightItem[],
    batchId: string,
    operator: string
  ): ConflictRecord[] {
    const conflicts: ConflictRecord[] = [];
    const activeScreenshot = systemStore.getActiveFormulaScreenshot();

    if (activeScreenshot) {
      const formulaConflicts = this.compareWithFormulaScreenshot(
        newWeights,
        activeScreenshot.formulaText,
        batchId,
        operator
      );
      conflicts.push(...formulaConflicts);
    }

    const duplicateConflicts = this.detectDuplicateImports(batchId, operator);
    conflicts.push(...duplicateConflicts);

    return conflicts;
  }

  private compareWithFormulaScreenshot(
    weights: ScoringWeightItem[],
    formulaText: string,
    batchId: string,
    operator: string
  ): ConflictRecord[] {
    const conflicts: ConflictRecord[] = [];
    const formulaMap = this.extractFormulaMap(formulaText);

    for (const weight of weights) {
      if (weight.formula) {
        const expectedFormula = formulaMap[weight.criterionId];
        if (expectedFormula && expectedFormula !== weight.formula) {
          const conflict: ConflictRecord = {
            id: generateId(),
            type: ConflictType.WEIGHT_FORMULA_MISMATCH,
            relatedEntityType: 'weight',
            relatedEntityId: weight.id,
            title: `${weight.criterionName} 公式不一致`,
            description: `评分标准公式与旧公式截图不一致，需要业务运营确认`,
            originalStatement: `公式表为"${weight.formula}"，旧公式截图显示为"${expectedFormula}"`,
            evidence: [
              {
                source: DataSource.WEIGHT_TABLE,
                fieldName: 'formula',
                originalValue: weight.formula,
                currentValue: weight.formula,
                expectedValue: expectedFormula,
                actualValue: weight.formula,
                location: `批次: ${batchId}`
              },
              {
                source: DataSource.FORMULA_SCREENSHOT,
                fieldName: 'formula',
                originalValue: expectedFormula,
                currentValue: expectedFormula,
                expectedValue: weight.formula,
                actualValue: expectedFormula,
                location: '旧公式截图'
              }
            ],
            status: ConflictStatus.PENDING,
            createdAt: new Date(),
            changeHistory: [],
            nextStepContact: '请联系业务运营张经理确认最终公式口径'
          };
          systemStore.addConflictRecord(conflict);
          conflicts.push(conflict);

          createAuditLog(
            'conflict',
            conflict.id,
            AuditAction.CREATE,
            operator,
            `检测到公式冲突: ${weight.criterionName} - ${weight.formula} vs ${expectedFormula}`,
            [],
            conflict.nextStepContact
          );
        }
      }
    }

    return conflicts;
  }

  private extractFormulaMap(formulaText: string): Record<string, string> {
    const formulaMap: Record<string, string> = {};
    const lines = formulaText.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+)\s*[:：]\s*(.+)$/);
      if (match) {
        formulaMap[match[1]] = match[2].trim();
      }
    }
    return formulaMap;
  }

  private detectDuplicateImports(batchId: string, operator: string): ConflictRecord[] {
    const conflicts: ConflictRecord[] = [];
    const currentWeights = systemStore.getScoringWeights().filter(
      w => w.importBatchId !== batchId
    );

    const newWeights = systemStore.getScoringWeights().filter(
      w => w.importBatchId === batchId
    );

    for (const newWeight of newWeights) {
      const existingWeights = currentWeights.filter(
        w => w.criterionId === newWeight.criterionId
      );
      for (const existing of existingWeights) {
        if (
          existing.weight !== newWeight.weight ||
          existing.maxScore !== newWeight.maxScore ||
          existing.formula !== newWeight.formula
        ) {
          const conflict: ConflictRecord = {
            id: generateId(),
            type: ConflictType.IMPORT_VERSION_CONFLICT,
            relatedEntityType: 'weight',
            relatedEntityId: newWeight.id,
            title: `${newWeight.criterionName} 版本冲突`,
            description: `存在多个导入版本，权重/分值/公式有差异`,
            originalStatement: `旧版本: 权重=${existing.weight}, 满分=${existing.maxScore}, 公式=${existing.formula}; 新版本: 权重=${newWeight.weight}, 满分=${newWeight.maxScore}, 公式=${newWeight.formula}`,
            evidence: [
              {
                source: DataSource.WEIGHT_TABLE,
                fieldName: 'weight',
                originalValue: existing.weight,
                currentValue: newWeight.weight,
                expectedValue: existing.weight,
                actualValue: newWeight.weight,
                location: `原有批次: ${existing.importBatchId}`
              },
              {
                source: DataSource.WEIGHT_TABLE,
                fieldName: 'weight',
                originalValue: newWeight.weight,
                currentValue: existing.weight,
                expectedValue: newWeight.weight,
                actualValue: existing.weight,
                location: `新批次: ${batchId}`
              }
            ],
            status: ConflictStatus.PENDING,
            createdAt: new Date(),
            changeHistory: [],
            nextStepContact: '请确认以哪个版本为准'
          };
          systemStore.addConflictRecord(conflict);
          conflicts.push(conflict);

          createAuditLog(
            'conflict',
            conflict.id,
            AuditAction.CREATE,
            operator,
            `检测到版本冲突: ${newWeight.criterionName}`,
            [],
            conflict.nextStepContact
          );
        }
      }
    }

    return conflicts;
  }

  public correctWeightFormula(
    weightId: string,
    correctedFormula: string,
    correctionReason: string,
    operator: string,
    nextStepContact?: string
  ): ScoringWeightItem | null {
    const weight = systemStore
      .getScoringWeights()
      .find(w => w.id === weightId);
    if (!weight) return null;

    const originalFormula = weight.formula;
    if (originalFormula !== correctedFormula) {
      weight.changeHistory = appendChangeHistory(
        weight.changeHistory,
        'formula',
        originalFormula,
        correctedFormula,
        operator,
        correctionReason
      );
    }

    weight.originalFormula = originalFormula ?? weight.originalFormula;
    weight.correctedFormula = correctedFormula;
    weight.formula = correctedFormula;
    weight.correctionReason = correctionReason;
    weight.source = DataSource.BUSINESS_CONFIRMED;

    systemStore.updateScoringWeight(weight);

    createAuditLog(
      'weight',
      weightId,
      AuditAction.UPDATE,
      operator,
      `修正公式: ${originalFormula} → ${correctedFormula}，原因: ${correctionReason}`,
      weight.changeHistory,
      nextStepContact
    );

    return weight;
  }

  public resolveConflict(
    conflictId: string,
    status: ConflictStatus,
    resolvedBy: string,
    notes: string,
    correctedStatement?: string,
    processingReason?: string,
    nextStepContact?: string
  ): ConflictRecord | null {
    const conflict = systemStore
      .getConflictRecords()
      .find(c => c.id === conflictId);
    if (!conflict) return null;

    const originalStatus = conflict.status;
    if (originalStatus !== status) {
      conflict.changeHistory = appendChangeHistory(
        conflict.changeHistory,
        'status',
        originalStatus,
        status,
        resolvedBy,
        notes
      );
    }

    conflict.status = status;
    conflict.resolvedBy = resolvedBy;
    conflict.resolvedAt = new Date();
    conflict.resolutionNotes = notes;
    conflict.correctedStatement = correctedStatement;
    conflict.processingReason = processingReason;
    conflict.nextStepContact = nextStepContact;

    systemStore.updateConflictRecord(conflict);

    createAuditLog(
      'conflict',
      conflictId,
      AuditAction.CONFLICT_RESOLVE,
      resolvedBy,
      `冲突处理: ${originalStatus} → ${status}; ${processingReason || notes}`,
      conflict.changeHistory,
      nextStepContact
    );

    return conflict;
  }

  public getPendingConflicts(): ConflictRecord[] {
    return systemStore.getPendingConflicts();
  }

  public getConflictWithEvidence(conflictId: string): ConflictRecord | undefined {
    return systemStore.getConflictById(conflictId);
  }

  public getWeightBatches(): ImportBatch[] {
    return systemStore.getWeightBatches();
  }

  public getScoringWeights(batchId?: string): ScoringWeightItem[] {
    return batchId
      ? systemStore.getActiveScoringWeights(batchId)
      : systemStore.getActiveScoringWeights();
  }
}

export default new WeightImportService();
