import { WeightRow, WeightTableData, WeightRowStatus, ChangeHistoryEntry, ReviewInfo, ImportBatch } from '../types';
import { parseWeightValue, validateWeightTable, isValidNumber } from './validation';
import { analyzeMatrixCondition } from './matrix';
import { createHistoryEntry } from './resultSource';
import { generateFingerprint, findMatchedBatchId, generateBatchId, FileFingerprint } from './fingerprint';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function createWeightRow(
  criterionName: string,
  originalValue: string,
  originalRowNumber: number,
  importBatchId: string
): WeightRow {
  const validation = isValidNumber(originalValue);
  const { number: currentValue, isPercent } = parseWeightValue(originalValue);
  
  let status: WeightRowStatus = 'pending';
  if (validation) {
    status = 'normal';
  } else {
    status = 'error';
  }

  return {
    id: generateId(),
    originalRowNumber,
    criterionName,
    originalImportValue: originalValue,
    originalValue,
    currentValue,
    isPercent,
    status,
    warnings: [],
    isManualModified: false,
    importBatchId,
    isDuplicateImport: false
  };
}

export interface ImportContext {
  rawData: Array<{ criterion: string; weight: string }>;
  importedBy?: string;
  fileName?: string;
  fileSize?: number;
  existingBatches?: ImportBatch[];
  existingRows?: WeightRow[];
}

export function processImportedData(
  context: ImportContext
): WeightTableData {
  const {
    rawData,
    importedBy = '吴老师',
    fileName = '评分权重表.xlsx',
    fileSize = 0,
    existingBatches = [],
    existingRows = []
  } = context;

  const fingerprint = generateFingerprint(rawData, fileSize, fileName);
  const matchedBatchId = findMatchedBatchId(fingerprint, existingBatches);
  const isDuplicate = !!matchedBatchId;
  const batchId = isDuplicate && matchedBatchId ? matchedBatchId : generateBatchId();

  const rows = rawData.map((item, index) => {
    const row = createWeightRow(item.criterion, item.weight, index + 2, batchId);
    
    if (isDuplicate) {
      row.isDuplicateImport = true;
      row.warnings.push('duplicate_import');
      
      const matchedRow = existingRows.find(
        r => r.criterionName.toLowerCase() === item.criterion.toLowerCase() && 
             r.originalImportValue === item.weight
      );
      if (matchedRow) {
        row.matchedRowId = matchedRow.id;
        row.status = matchedRow.status;
        row.warnings.push(...matchedRow.warnings.filter(w => w !== 'duplicate_import'));
        row.isManualModified = matchedRow.isManualModified;
        row.modifiedBy = matchedRow.modifiedBy;
        row.modifiedAt = matchedRow.modifiedAt;
        row.notes = matchedRow.notes;
        row.reviewInfo = matchedRow.reviewInfo;
        if (matchedRow.modifiedValue) {
          row.modifiedValue = matchedRow.modifiedValue;
          const { number } = parseWeightValue(matchedRow.modifiedValue);
          row.currentValue = number;
        }
      }
      
      if (row.status === 'normal') {
        row.status = 'warning';
      }
    }
    
    return row;
  });

  const validatedRows = validateWeightTable(rows);
  const matrixResult = analyzeMatrixCondition(validatedRows);

  const finalRows = validatedRows.map(row => {
    if (matrixResult.isWarning && !row.warnings.includes('high_condition_number')) {
      row.warnings.push('high_condition_number');
      if (row.status === 'normal') {
        row.status = 'warning';
      }
    }
    return row;
  });

  const importTime = new Date();
  const newBatch: ImportBatch = {
    id: batchId,
    fingerprint: fingerprint.combined,
    fileName,
    fileSize,
    rowCount: rawData.length,
    importTime,
    importedBy,
    isDuplicate,
    matchedBatchId
  };

  const initialHistory: ChangeHistoryEntry[] = finalRows.map(row => 
    createHistoryEntry({
      row,
      field: 'originalValue',
      oldValue: '(导入)',
      newValue: row.originalImportValue,
      changedBy: importedBy,
      reason: isDuplicate 
        ? `重复导入检测：文件指纹[${fingerprint.contentHash}]匹配已有批次` 
        : `导入数据，原始行号 ${row.originalRowNumber}，批次 ${batchId}`
    })
  );

  return {
    rows: finalRows,
    importTime,
    importedBy,
    matrixResult,
    processStep: 'step1_imported',
    hasReviewStatus: 'not_viewed',
    history: initialHistory,
    dataVersion: 1,
    importBatches: isDuplicate ? existingBatches : [...existingBatches, newBatch],
    currentBatchId: batchId
  };
}

export function updateWeightRow(
  row: WeightRow,
  newValue: string,
  modifiedBy: string = '吴老师',
  reason: string = '补录修正'
): { row: WeightRow; historyEntry: ChangeHistoryEntry } {
  const oldDisplayValue = row.originalValue;
  const validation = isValidNumber(newValue);
  const { number: currentValue, isPercent } = parseWeightValue(newValue);

  let status: WeightRowStatus = row.status;
  if (!validation) {
    status = 'error';
  }

  const updatedRow: WeightRow = {
    ...row,
    originalImportValue: row.originalImportValue,
    modifiedValue: newValue,
    originalValue: newValue,
    currentValue,
    isPercent,
    status,
    isManualModified: true,
    modifiedBy,
    modifiedAt: new Date()
  };

  const historyEntry = createHistoryEntry({
    row: updatedRow,
    field: 'modifiedValue',
    oldValue: `${oldDisplayValue} (原始说法: ${row.originalImportValue})`,
    newValue: `${newValue} (原始说法保留: ${row.originalImportValue})`,
    changedBy: modifiedBy,
    reason: `${reason}。原始说法 ${row.originalImportValue} 保留不覆盖，改后值 ${newValue}`
  });

  return { row: updatedRow, historyEntry };
}

export function markRowReviewed(
  row: WeightRow,
  params: {
    reason: string;
    nextHandler: string;
    reviewedBy: string;
    finalizeStatus?: WeightRowStatus;
  }
): { row: WeightRow; historyEntries: ChangeHistoryEntry[] } {
  const historyEntries: ChangeHistoryEntry[] = [];
  const oldStatus = row.status;
  const newStatus = params.finalizeStatus || (
    row.warnings.some(w => w === 'percent_decimal_mixed' || w === 'duplicate_import')
      ? 'needs_review'
      : row.warnings.length === 0 ? 'normal' : 'needs_review'
  );

  const displayPrevious = row.originalImportValue;
  const displayNew = row.modifiedValue || row.originalImportValue;

  const reviewInfo: ReviewInfo = {
    previousValue: displayPrevious,
    previousRawValue: displayPrevious,
    newValue: displayNew,
    newRawValue: displayNew,
    reason: params.reason,
    nextHandler: params.nextHandler,
    reviewedAt: new Date(),
    reviewedBy: params.reviewedBy,
    finalized: !row.warnings.includes('percent_decimal_mixed') && 
               !row.warnings.includes('duplicate_import') &&
               !!params.finalizeStatus
  };

  const updatedRow: WeightRow = {
    ...row,
    status: newStatus,
    reviewInfo
  };

  historyEntries.push(createHistoryEntry({
    row: updatedRow,
    field: 'status',
    oldValue: oldStatus,
    newValue: newStatus,
    changedBy: params.reviewedBy,
    reason: `复核：原始说法=${displayPrevious}, 改后值=${displayNew}, 原因=${params.reason} → 下一步找${params.nextHandler}`
  }));

  return { row: updatedRow, historyEntries };
}

export function updateRowNote(
  row: WeightRow,
  note: string,
  changedBy: string = '吴老师'
): { row: WeightRow; historyEntry?: ChangeHistoryEntry } {
  if (row.notes === note) {
    return { row };
  }
  const oldNote = row.notes || '(空)';
  const updatedRow = { ...row, notes: note };
  const historyEntry = createHistoryEntry({
    row: updatedRow,
    field: 'notes',
    oldValue: oldNote,
    newValue: note || '(空)',
    changedBy,
    reason: `更新备注。原始说法=${row.originalImportValue}`
  });
  return { row: updatedRow, historyEntry };
}

export function recalculateAfterEdit(
  data: WeightTableData,
  additionalHistory: ChangeHistoryEntry[] = []
): WeightTableData {
  const validatedRows = validateWeightTable(data.rows);
  const matrixResult = analyzeMatrixCondition(validatedRows);

  const statusChanges: ChangeHistoryEntry[] = [];

  const finalRows = validatedRows.map(row => {
    const oldStatus = row.status;
    const oldWarnings = [...row.warnings];
    
    const highConditionWarning = row.warnings.indexOf('high_condition_number');
    if (highConditionWarning > -1) {
      row.warnings.splice(highConditionWarning, 1);
    }
    
    if (matrixResult.isWarning && !row.warnings.includes('high_condition_number')) {
      row.warnings.push('high_condition_number');
    }

    let newStatus = row.status;

    const hasPercentMixed = row.warnings.includes('percent_decimal_mixed');
    const hasDuplicateImport = row.warnings.includes('duplicate_import');
    const hasDuplicateRow = row.warnings.includes('duplicate_row');
    const hasInvalid = row.warnings.includes('invalid_value');
    const hasHighCondition = row.warnings.includes('high_condition_number');

    if (hasInvalid) {
      newStatus = 'error';
    } else if (hasPercentMixed || hasDuplicateImport) {
      newStatus = 'needs_review';
    } else if (hasDuplicateRow || hasHighCondition) {
      newStatus = 'warning';
    } else if (row.reviewInfo && !row.reviewInfo.finalized) {
      newStatus = 'needs_review';
    } else if (!row.isManualModified && oldStatus === 'normal') {
      newStatus = 'normal';
    } else if (row.warnings.length === 0) {
      newStatus = row.isManualModified ? 'pending' : 'normal';
    }

    if (newStatus !== oldStatus) {
      const warningsChanged = oldWarnings.join(',') !== row.warnings.join(',');
      statusChanges.push(createHistoryEntry({
        row,
        field: 'status',
        oldValue: oldStatus,
        newValue: newStatus,
        changedBy: '系统',
        reason: warningsChanged 
          ? `校验重算：原始说法=${row.originalImportValue}, 警告=[${row.warnings.join(',')}]` 
          : `校验重算更新状态，原始说法=${row.originalImportValue}`
      }));
      row.status = newStatus;
    }
    
    return row;
  });

  const allHistory = [...data.history, ...additionalHistory, ...statusChanges];

  return {
    ...data,
    rows: finalRows,
    matrixResult,
    history: allHistory,
    dataVersion: data.dataVersion + 1
  };
}

export function advanceProcessStep(data: WeightTableData): WeightTableData {
  const stepOrder: Array<'step1_imported' | 'step2_formula_review' | 'step3_calculation_updated'> = 
    ['step1_imported', 'step2_formula_review', 'step3_calculation_updated'];
  
  const currentIndex = stepOrder.indexOf(data.processStep);
  if (currentIndex < stepOrder.length - 1) {
    const nextStep = stepOrder[currentIndex + 1];
    return {
      ...data,
      processStep: nextStep,
      hasReviewStatus: currentIndex === 0 ? 'viewed' : 'confirmed',
      dataVersion: data.dataVersion + 1
    };
  }
  return data;
}

export function getOriginalDisplayValue(row: WeightRow): string {
  return row.originalImportValue;
}

export function getCurrentDisplayValue(row: WeightRow): string {
  return row.modifiedValue || row.originalImportValue;
}

export type { FileFingerprint };
