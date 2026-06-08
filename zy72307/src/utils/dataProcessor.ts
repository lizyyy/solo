import { WeightRow, WeightTableData, WeightRowStatus, ChangeHistoryEntry, ReviewInfo } from '../types';
import { parseWeightValue, validateWeightTable, isValidNumber } from './validation';
import { analyzeMatrixCondition } from './matrix';
import { createHistoryEntry } from './resultSource';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function createWeightRow(
  criterionName: string,
  originalValue: string,
  originalRowNumber: number
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
    originalValue,
    currentValue,
    isPercent,
    status,
    warnings: [],
    isManualModified: false
  };
}

export function processImportedData(
  rawData: Array<{ criterion: string; weight: string }>,
  importedBy: string = '吴老师'
): WeightTableData {
  const rows = rawData.map((item, index) => 
    createWeightRow(item.criterion, item.weight, index + 2)
  );

  const validatedRows = validateWeightTable(rows);
  const matrixResult = analyzeMatrixCondition(validatedRows);

  const finalRows = validatedRows.map(row => {
    if (matrixResult.isWarning) {
      row.warnings.push('high_condition_number');
      if (row.status === 'normal') {
        row.status = 'warning';
      }
    }
    return row;
  });

  const importTime = new Date();
  const initialHistory: ChangeHistoryEntry[] = finalRows.map(row => 
    createHistoryEntry({
      row,
      field: 'originalValue',
      oldValue: '(导入)',
      newValue: row.originalValue,
      changedBy: importedBy,
      reason: `导入数据，原始行号 ${row.originalRowNumber}`
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
    dataVersion: 1
  };
}

export function updateWeightRow(
  row: WeightRow,
  newValue: string,
  modifiedBy: string = '吴老师',
  reason: string = '补录修正'
): { row: WeightRow; historyEntry: ChangeHistoryEntry } {
  const oldValue = row.originalValue;
  const validation = isValidNumber(newValue);
  const { number: currentValue, isPercent } = parseWeightValue(newValue);

  let status: WeightRowStatus = row.status;
  if (!validation) {
    status = 'error';
  }

  const updatedRow: WeightRow = {
    ...row,
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
    field: 'originalValue',
    oldValue,
    newValue,
    changedBy: modifiedBy,
    reason
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
    row.warnings.length === 0 ? 'normal' : 'needs_review'
  );

  const reviewInfo: ReviewInfo = {
    previousValue: row.originalValue,
    newValue: row.originalValue,
    reason: params.reason,
    nextHandler: params.nextHandler,
    reviewedAt: new Date(),
    reviewedBy: params.reviewedBy,
    finalized: row.warnings.length === 0 && !params.finalizeStatus ? false : true
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
    reason: `复核：${params.reason} → 下一步：${params.nextHandler}`
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
    reason: '更新备注'
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
    
    if (matrixResult.isWarning) {
      row.warnings.push('high_condition_number');
    }

    let newStatus = row.status;

    const hasPercentMixed = row.warnings.includes('percent_decimal_mixed');
    const hasDuplicate = row.warnings.includes('duplicate_row');
    const hasInvalid = row.warnings.includes('invalid_value');
    const hasHighCondition = row.warnings.includes('high_condition_number');

    if (hasInvalid) {
      newStatus = 'error';
    } else if (hasPercentMixed) {
      newStatus = 'needs_review';
    } else if (hasDuplicate || hasHighCondition) {
      newStatus = 'warning';
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
          ? `校验重算：警告=[${row.warnings.join(',')}]` 
          : `校验重算更新状态`
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
