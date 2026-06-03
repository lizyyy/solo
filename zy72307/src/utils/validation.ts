import { WeightRow, WarningType, ValidationResult } from '../types';

export function parseWeightValue(value: string): { number: number; isPercent: boolean } {
  const trimmed = value.trim();
  
  if (trimmed.endsWith('%')) {
    const numValue = parseFloat(trimmed.slice(0, -1));
    return { number: numValue / 100, isPercent: true };
  }
  
  return { number: parseFloat(trimmed), isPercent: false };
}

export function isValidNumber(value: string): boolean {
  const trimmed = value.trim();
  const numValue = trimmed.endsWith('%') 
    ? parseFloat(trimmed.slice(0, -1))
    : parseFloat(trimmed);
  
  return !isNaN(numValue) && isFinite(numValue);
}

export function detectPercentDecimalMix(rows: WeightRow[]): WarningType | null {
  const hasPercent = rows.some(r => r.isPercent);
  const hasDecimal = rows.some(r => !r.isPercent);
  
  if (hasPercent && hasDecimal) {
    return 'percent_decimal_mixed';
  }
  return null;
}

export function detectDuplicateRows(rows: WeightRow[]): WarningType | null {
  const seen = new Set<string>();
  
  for (const row of rows) {
    const key = row.criterionName.toLowerCase();
    
    if (seen.has(key)) {
      return 'duplicate_row';
    }
    seen.add(key);
  }
  return null;
}

export function validateRow(value: string): ValidationResult {
  const warnings: WarningType[] = [];
  
  if (!isValidNumber(value)) {
    return { isValid: false, warnings: ['invalid_value'], message: '无效的数值格式' };
  }
  
  return { isValid: true, warnings, message: '校验通过' };
}

export function validateWeightTable(rows: WeightRow[]): WeightRow[] {
  const updatedRows = rows.map(row => ({ ...row, warnings: [] as WarningType[] }));
  
  const mixWarning = detectPercentDecimalMix(updatedRows);
  if (mixWarning) {
    updatedRows.forEach(row => {
      row.warnings.push(mixWarning);
      if (row.status === 'normal') {
        row.status = 'needs_review';
      }
    });
  }
  
  const criterionCounts: Record<string, number[]> = {};
  updatedRows.forEach((row, index) => {
    const key = row.criterionName.toLowerCase();
    if (!criterionCounts[key]) {
      criterionCounts[key] = [];
    }
    criterionCounts[key].push(index);
  });
  
  Object.values(criterionCounts).forEach(indices => {
    if (indices.length > 1) {
      indices.forEach(idx => {
        updatedRows[idx].warnings.push('duplicate_row');
        if (updatedRows[idx].status === 'normal') {
          updatedRows[idx].status = 'warning';
        }
      });
    }
  });
  
  return updatedRows;
}
