const FormulaParser = require('./formula-parser');

const ERROR_TYPES = {
  SHEET_NOT_FOUND: 'SHEET_NOT_FOUND',
  CELL_OUT_OF_RANGE: 'CELL_OUT_OF_RANGE',
  RANGE_OUT_OF_BOUNDS: 'RANGE_OUT_OF_BOUNDS',
  CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE',
  INVALID_REFERENCE: 'INVALID_REFERENCE',
  EMPTY_SHEET_REFERENCE: 'EMPTY_SHEET_REFERENCE'
};

class ReferenceValidator {
  constructor(workbook) {
    this.workbook = workbook;
    this.formulaParser = new FormulaParser();
    this.sheetNames = workbook.SheetNames || [];
    this.sheetData = new Map();
    this._initSheetData();
  }

  _initSheetData() {
    for (const sheetName of this.sheetNames) {
      const sheet = this.workbook.Sheets[sheetName];
      const range = sheet['!ref'] || 'A1:A1';
      const [start, end] = range.split(':');
      
      this.sheetData.set(sheetName, {
        sheet,
        range,
        startCell: start,
        endCell: end,
        startAddr: this.formulaParser.parseCellAddress(start),
        endAddr: this.formulaParser.parseCellAddress(end),
        cells: new Set(Object.keys(sheet).filter(k => !k.startsWith('!')))
      });
    }
  }

  validateWorkbook() {
    const results = {
      summary: {
        totalSheets: this.sheetNames.length,
        totalFormulas: 0,
        totalReferences: 0,
        totalErrors: 0,
        totalWarnings: 0,
        errorByType: {}
      },
      sheets: {},
      errors: [],
      warnings: []
    };

    for (const sheetName of this.sheetNames) {
      const sheetResults = this._validateSheet(sheetName);
      results.sheets[sheetName] = sheetResults;
      results.summary.totalFormulas += sheetResults.formulaCount;
      results.summary.totalReferences += sheetResults.referenceCount;
      results.errors.push(...sheetResults.errors);
      results.warnings.push(...sheetResults.warnings);
    }

    results.summary.totalErrors = results.errors.length;
    results.summary.totalWarnings = results.warnings.length;
    
    for (const error of results.errors) {
      results.summary.errorByType[error.errorType] = 
        (results.summary.errorByType[error.errorType] || 0) + 1;
    }

    return results;
  }

  _validateSheet(sheetName) {
    const sheetInfo = this.sheetData.get(sheetName);
    const sheet = sheetInfo.sheet;
    
    const result = {
      sheetName,
      formulaCount: 0,
      referenceCount: 0,
      errors: [],
      warnings: [],
      cells: {}
    };

    for (const cellAddr of Object.keys(sheet)) {
      if (cellAddr.startsWith('!')) continue;
      
      const cell = sheet[cellAddr];
      const formula = cell.f;
      
      if (formula) {
        result.formulaCount++;
        result.cells[cellAddr] = this._validateCellFormula(sheetName, cellAddr, formula);
        result.referenceCount += result.cells[cellAddr].references.length;
        result.errors.push(...result.cells[cellAddr].errors);
        result.warnings.push(...result.cells[cellAddr].warnings);
      }
    }

    return result;
  }

  _validateCellFormula(sheetName, cellAddr, formula) {
    const parsed = this.formulaParser.parseFormula(formula, sheetName);
    
    const result = {
      cellAddr,
      formula,
      references: parsed.references || [],
      errors: [],
      warnings: []
    };

    if (!parsed.hasFormula) return result;

    for (const ref of parsed.references || []) {
      const refErrors = this._validateReference(ref, sheetName, cellAddr);
      result.errors.push(...refErrors);
    }

    return result;
  }

  _validateReference(reference, sourceSheet, sourceCell) {
    const errors = [];
    const targetSheetName = reference.sheetName;

    if (!targetSheetName || targetSheetName.trim() === '') {
      errors.push(this._createError(
        ERROR_TYPES.EMPTY_SHEET_REFERENCE,
        sourceSheet,
        sourceCell,
        reference,
        '引用的工作表名称为空'
      ));
      return errors;
    }

    if (!this.sheetNames.includes(targetSheetName)) {
      errors.push(this._createError(
        ERROR_TYPES.SHEET_NOT_FOUND,
        sourceSheet,
        sourceCell,
        reference,
        `工作表 "${targetSheetName}" 不存在`
      ));
      return errors;
    }

    const targetSheetInfo = this.sheetData.get(targetSheetName);
    const targetEndAddr = targetSheetInfo.endAddr;

    if (reference.type === 'cell') {
      const cellAddr = this.formulaParser.parseCellAddress(reference.cell);
      if (cellAddr) {
        if (cellAddr.col > targetEndAddr.col || cellAddr.row > targetEndAddr.row) {
          errors.push(this._createError(
            ERROR_TYPES.CELL_OUT_OF_RANGE,
            sourceSheet,
            sourceCell,
            reference,
            `单元格 ${reference.cell} 超出工作表 "${targetSheetName}" 的范围 (${targetSheetInfo.range})`
          ));
        }
      } else {
        errors.push(this._createError(
          ERROR_TYPES.INVALID_REFERENCE,
          sourceSheet,
          sourceCell,
          reference,
          `无效的单元格引用格式: ${reference.cell}`
        ));
      }
    } else if (reference.type === 'range') {
      const startAddr = this.formulaParser.parseCellAddress(reference.startCell);
      const endAddr = this.formulaParser.parseCellAddress(reference.endCell);
      
      if (startAddr && endAddr) {
        if (endAddr.col > targetEndAddr.col || endAddr.row > targetEndAddr.row) {
          errors.push(this._createError(
            ERROR_TYPES.RANGE_OUT_OF_BOUNDS,
            sourceSheet,
            sourceCell,
            reference,
            `范围 ${reference.startCell}:${reference.endCell} 超出工作表 "${targetSheetName}" 的范围 (${targetSheetInfo.range})`
          ));
        }
      } else {
        errors.push(this._createError(
          ERROR_TYPES.INVALID_REFERENCE,
          sourceSheet,
          sourceCell,
          reference,
          `无效的范围引用格式: ${reference.startCell}:${reference.endCell}`
        ));
      }
    }

    return errors;
  }

  _createError(errorType, sourceSheet, sourceCell, reference, message) {
    return {
      errorType,
      sourceSheet,
      sourceCell,
      reference: reference.raw,
      referenceType: reference.type,
      targetSheet: reference.sheetName,
      targetCell: reference.cell || `${reference.startCell}:${reference.endCell}`,
      message,
      timestamp: new Date().toISOString()
    };
  }
}

ReferenceValidator.ERROR_TYPES = ERROR_TYPES;

module.exports = ReferenceValidator;
