import { BaseValidator } from './base.js';

export class WhiteBalanceValidator extends BaseValidator {
  constructor() {
    super('white_balance');
  }

  validate(calibrationFiles) {
    this.reset();

    for (const calib of calibrationFiles) {
      const fileName = calib.fileName;
      const content = calib.content;

      if (content.white_balance_matrix) {
        this.validateMatrixDimensions(
          content.white_balance_matrix,
          fileName,
          'white_balance'
        );
      }

      if (content.ccm || content.color_correction_matrix) {
        const ccm = content.ccm || content.color_correction_matrix;
        this.validateMatrixDimensions(ccm, fileName, 'ccm');
      }

      this.validateWhiteBalanceGains(content, fileName);
      this.validateMatrixValues(content, fileName);
    }

    return {
      valid: this.isValid(),
      violations: this.getViolations()
    };
  }

  validateMatrixDimensions(matrix, fileName, matrixType) {
    if (!Array.isArray(matrix)) {
      this.addViolation(
        'error',
        `${matrixType}_matrix_invalid`,
        `${matrixType} matrix is not an array`,
        { fileName, matrixType }
      );
      return;
    }

    const expectedRows = matrixType === 'ccm' ? 3 : 3;
    const expectedCols = matrixType === 'ccm' ? 4 : 4;

    if (matrix.length !== expectedRows) {
      this.addViolation(
        'error',
        `${matrixType}_matrix_row_count`,
        `${matrixType} matrix has ${matrix.length} rows, expected ${expectedRows}`,
        { fileName, matrixType, actualRows: matrix.length, expectedRows }
      );
      return;
    }

    for (let row = 0; row < matrix.length; row++) {
      const rowData = matrix[row];
      
      if (!Array.isArray(rowData)) {
        this.addViolation(
          'error',
          `${matrixType}_matrix_row_invalid`,
          `${matrixType} matrix row ${row} is not an array`,
          { fileName, matrixType, row }
        );
        continue;
      }

      if (rowData.length !== expectedCols) {
        this.addViolation(
          'error',
          `${matrixType}_matrix_col_count`,
          `${matrixType} matrix row ${row} has ${rowData.length} columns, expected ${expectedCols}`,
          { fileName, matrixType, row, actualCols: rowData.length, expectedCols }
        );
      }
    }
  }

  validateWhiteBalanceGains(content, fileName) {
    const gains = content.white_balance_gains || content.wb_gains;
    
    if (!gains) return;

    if (Array.isArray(gains)) {
      if (gains.length !== 4) {
        this.addViolation(
          'warning',
          'wb_gains_length',
          `White balance gains array has ${gains.length} elements, typically expects 4 (RGGB)`,
          { fileName, actualLength: gains.length, expectedLength: 4 }
        );
      }

      for (let i = 0; i < gains.length; i++) {
        const gain = gains[i];
        if (typeof gain !== 'number') {
          this.addViolation(
            'error',
            'wb_gains_type',
            `White balance gain at index ${i} is not a number`,
            { fileName, index: i, type: typeof gain }
          );
        } else if (Number.isNaN(gain)) {
          this.addViolation(
            'error',
            'wb_gains_nan',
            `White balance gain at index ${i} is NaN`,
            { fileName, index: i }
          );
        } else if (gain <= 0) {
          this.addViolation(
            'error',
            'wb_gains_non_positive',
            `White balance gain at index ${i} is non-positive: ${gain}`,
            { fileName, index: i, value: gain }
          );
        } else if (gain > 10) {
          this.addViolation(
            'warning',
            'wb_gains_high',
            `White balance gain at index ${i} is unusually high: ${gain}`,
            { fileName, index: i, value: gain }
          );
        }
      }
    } else if (typeof gains === 'object') {
      const expectedKeys = ['r', 'gr', 'gb', 'b'];
      for (const key of expectedKeys) {
        if (gains[key] === undefined) {
          this.addViolation(
            'warning',
            'wb_gains_missing_key',
            `White balance gains missing key: ${key}`,
            { fileName, missingKey: key }
          );
        }
      }
    }
  }

  validateMatrixValues(content, fileName) {
    this.validateMatrixContentValues(
      content.white_balance_matrix,
      fileName,
      'white_balance'
    );
    this.validateMatrixContentValues(
      content.ccm || content.color_correction_matrix,
      fileName,
      'ccm'
    );
  }

  validateMatrixContentValues(matrix, fileName, matrixType) {
    if (!Array.isArray(matrix)) return;

    for (let row = 0; row < matrix.length; row++) {
      const rowData = matrix[row];
      if (!Array.isArray(rowData)) continue;

      for (let col = 0; col < rowData.length; col++) {
        const value = rowData[col];
        
        if (typeof value !== 'number') {
          this.addViolation(
            'error',
            `${matrixType}_matrix_value_type`,
            `${matrixType} matrix value at [${row}][${col}] is not a number`,
            { fileName, matrixType, row, col, type: typeof value }
          );
          continue;
        }

        if (Number.isNaN(value)) {
          this.addViolation(
            'error',
            `${matrixType}_matrix_value_nan`,
            `${matrixType} matrix value at [${row}][${col}] is NaN`,
            { fileName, matrixType, row, col }
          );
        } else if (!Number.isFinite(value)) {
          this.addViolation(
            'error',
            `${matrixType}_matrix_value_infinite`,
            `${matrixType} matrix value at [${row}][${col}] is infinite`,
            { fileName, matrixType, row, col }
          );
        }
      }
    }
  }
}
