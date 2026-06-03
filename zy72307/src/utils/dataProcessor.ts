import { WeightRow, WeightTableData, WeightRowStatus } from '../types';
import { parseWeightValue, validateWeightTable, isValidNumber } from './validation';
import { analyzeMatrixCondition } from './matrix';

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

  return {
    rows: finalRows,
    importTime: new Date(),
    importedBy,
    matrixResult,
    processStep: 'step1_imported',
    hasReviewStatus: 'not_viewed'
  };
}

export function updateWeightRow(
  row: WeightRow,
  newValue: string,
  modifiedBy: string = '吴老师'
): WeightRow {
  const validation = isValidNumber(newValue);
  const { number: currentValue, isPercent } = parseWeightValue(newValue);

  let status: WeightRowStatus = row.status;
  if (!validation) {
    status = 'error';
  }

  return {
    ...row,
    originalValue: newValue,
    currentValue,
    isPercent,
    status,
    isManualModified: true,
    modifiedBy,
    modifiedAt: new Date()
  };
}

export function recalculateAfterEdit(
  data: WeightTableData
): WeightTableData {
  const validatedRows = validateWeightTable(data.rows);
  const matrixResult = analyzeMatrixCondition(validatedRows);

  const finalRows = validatedRows.map(row => {
    const highConditionWarning = row.warnings.indexOf('high_condition_number');
    if (highConditionWarning > -1) {
      row.warnings.splice(highConditionWarning, 1);
    }
    
    if (matrixResult.isWarning) {
      row.warnings.push('high_condition_number');
      if (row.status === 'normal') {
        row.status = 'warning';
      }
    } else if (row.warnings.length === 0 && row.status === 'warning') {
      row.status = 'normal';
    }
    
    return row;
  });

  return {
    ...data,
    rows: finalRows,
    matrixResult
  };
}

export function advanceProcessStep(data: WeightTableData): WeightTableData {
  const stepOrder: Array<'step1_imported' | 'step2_formula_review' | 'step3_calculation_updated'> = 
    ['step1_imported', 'step2_formula_review', 'step3_calculation_updated'];
  
  const currentIndex = stepOrder.indexOf(data.processStep);
  if (currentIndex < stepOrder.length - 1) {
    return {
      ...data,
      processStep: stepOrder[currentIndex + 1],
      hasReviewStatus: currentIndex === 0 ? 'viewed' : 'confirmed'
    };
  }
  return data;
}
