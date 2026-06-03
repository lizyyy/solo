import { parse } from 'csv-parse/sync';
import systemStore from '../store/systemStore';
import { generateId, generateBatchNumber } from '../utils/idGenerator';
import {
  ScoringWeightItem,
  ImportBatch,
  DataSource,
  ConflictRecord,
  ConflictType,
  ConflictStatus,
  ConflictEvidence
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
    csvContent: string, importedBy: string): {
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
      isProcessed: true
    };

    const weights: ScoringWeightItem[] = records.map((row) => ({
      id: generateId(),
      criterionId: row.criterionId,
      criterionName: row.criterionName,
      weight: parseFloat(row.weight),
      maxScore: parseFloat(row.maxScore),
      formula: row.formula,
      source: DataSource.WEIGHT_TABLE,
      importBatchId: batchId,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    systemStore.addWeightBatch(batch);
    systemStore.addScoringWeights(weights);

    const conflicts = this.detectConflicts(weights, batchId);

    return { batch, weights, conflicts };
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
    batchId: string
  ): ConflictRecord[] {
    const conflicts: ConflictRecord[] = [];
    const activeScreenshot = systemStore.getActiveFormulaScreenshot();

    if (activeScreenshot) {
      const formulaConflicts = this.compareWithFormulaScreenshot(
        newWeights,
        activeScreenshot.formulaText,
        batchId
      );
      conflicts.push(...formulaConflicts);
    }

    const duplicateConflicts = this.detectDuplicateImports(batchId);
    conflicts.push(...duplicateConflicts);

    return conflicts;
  }

  private compareWithFormulaScreenshot(
    weights: ScoringWeightItem[],
    formulaText: string,
    batchId: string
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
            title: `评分标准公式不一致`,
            description: `评分标准"${weight.criterionName}"的公式与旧公式截图不一致`,
            evidence: [
              {
                source: DataSource.WEIGHT_TABLE,
                fieldName: 'formula',
                expectedValue: expectedFormula,
                actualValue: weight.formula,
                location: `批次: ${batchId}`
              },
              {
                source: DataSource.FORMULA_SCREENSHOT,
                fieldName: 'formula',
                expectedValue: weight.formula,
                actualValue: expectedFormula,
                location: '旧公式截图'
              }
            ],
            status: ConflictStatus.PENDING,
            createdAt: new Date()
          };
          systemStore.addConflictRecord(conflict);
          conflicts.push(conflict);
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

  private detectDuplicateImports(batchId: string): ConflictRecord[] {
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
          existing.maxScore !== newWeight.maxScore
        ) {
          const conflict: ConflictRecord = {
            id: generateId(),
            type: ConflictType.IMPORT_VERSION_CONFLICT,
            title: `评分标准版本冲突`,
            description: `评分标准"${newWeight.criterionName}"存在多个版本`,
            evidence: [
              {
                source: DataSource.WEIGHT_TABLE,
                fieldName: 'weight',
                expectedValue: existing.weight,
                actualValue: newWeight.weight,
                location: `原有批次: ${existing.importBatchId}`
              },
              {
                source: DataSource.WEIGHT_TABLE,
                fieldName: 'weight',
                expectedValue: newWeight.weight,
                actualValue: existing.weight,
                location: `新批次: ${batchId}`
              }
            ],
            status: ConflictStatus.PENDING,
            createdAt: new Date()
          };
          systemStore.addConflictRecord(conflict);
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  public resolveConflict(
    conflictId: string,
    status: ConflictStatus,
    resolvedBy: string,
    notes: string
  ): ConflictRecord | null {
    const conflict = systemStore
      .getConflictRecords()
      .find(c => c.id === conflictId);
    if (!conflict) return null;

    conflict.status = status;
    conflict.resolvedBy = resolvedBy;
    conflict.resolvedAt = new Date();
    conflict.resolutionNotes = notes;

    systemStore.updateConflictRecord(conflict);
    return conflict;
  }

  public getPendingConflicts(): ConflictRecord[] {
    return systemStore.getPendingConflicts();
  }
}

export default new WeightImportService();
