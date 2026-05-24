const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const exitCodes = require('./exit-codes');

class WorkbookParser {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.options = {
      includeHiddenSheets: false,
      resolveExternalLinks: false,
      ...options,
    };
    this.workbook = null;
    this.sheets = new Map();
    this.namedRanges = new Map();
    this.externalLinks = [];
  }

  validate() {
    if (!fs.existsSync(this.filePath)) {
      const error = new Error(`文件不存在: ${this.filePath}`);
      error.code = exitCodes.FILE_NOT_FOUND;
      throw error;
    }

    const ext = path.extname(this.filePath).toLowerCase();
    if (!['.xlsx', '.xlsm', '.xls', '.xlsb'].includes(ext)) {
      const error = new Error(`不支持的文件格式: ${ext}，仅支持 .xlsx, .xlsm, .xls, .xlsb`);
      error.code = exitCodes.INVALID_FILE_FORMAT;
      throw error;
    }

    return true;
  }

  parse() {
    this.validate();

    try {
      this.workbook = XLSX.readFile(this.filePath, {
        cellFormula: true,
        cellHTML: false,
        cellNF: false,
      });
    } catch (error) {
      const err = new Error(`解析工作簿失败: ${error.message}`);
      err.code = exitCodes.PARSING_ERROR;
      throw err;
    }

    this._parseSheets();
    this._parseNamedRanges();
    this._detectExternalLinks();

    return {
      filePath: this.filePath,
      sheets: Array.from(this.sheets.values()),
      namedRanges: Array.from(this.namedRanges.values()),
      externalLinks: this.externalLinks,
    };
  }

  _parseSheets() {
    const { SheetNames, Sheets, Workbook } = this.workbook;

    SheetNames.forEach((sheetName, index) => {
      const worksheet = Sheets[sheetName];
      const sheetInfo = Workbook?.Sheets?.[index] || {};

      const isHidden = sheetInfo.hidden === true || sheetInfo.hidden === 1;
      const isVeryHidden = sheetInfo.hidden === 2;

      if (!this.options.includeHiddenSheets && (isHidden || isVeryHidden)) {
        return;
      }

      const cells = this._parseCells(worksheet, sheetName);
      const formulas = cells.filter(cell => cell.formula);

      this.sheets.set(sheetName, {
        name: sheetName,
        index,
        isHidden,
        isVeryHidden,
        cells,
        formulas,
        cellCount: cells.length,
        formulaCount: formulas.length,
      });
    });
  }

  _parseCells(worksheet, sheetName) {
    const cells = [];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');

    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];

        if (!cell) continue;

        let formula = cell.f || null;
        let value = cell.v;

        if (!formula && typeof cell.v === 'string' && cell.v.startsWith('=')) {
          formula = cell.v.substring(1);
          value = null;
        }

        cells.push({
          address: `${sheetName}!${cellAddress}`,
          sheetName,
          cell: cellAddress,
          row: row + 1,
          col: col + 1,
          value,
          formula,
          dataType: cell.t,
        });
      }
    }

    return cells;
  }

  _parseNamedRanges() {
    const names = this.workbook.Workbook?.Names || [];

    names.forEach(name => {
      const ref = name.Ref;
      const sheetName = ref.split('!')[0].replace(/'/g, '');

      this.namedRanges.set(name.Name, {
        name: name.Name,
        reference: ref,
        sheetName,
        comment: name.Comment || '',
      });
    });
  }

  _detectExternalLinks() {
    const externalRegex = /\[(.*?)\](.*?)!/g;

    this.sheets.forEach(sheet => {
      sheet.formulas.forEach(cell => {
        let match;
        while ((match = externalRegex.exec(cell.formula)) !== null) {
          const link = {
            file: match[1],
            path: match[2],
            sourceCell: cell.address,
            sourceSheet: sheet.name,
          };

          if (!this.externalLinks.some(l => l.file === link.file && l.path === link.path)) {
            this.externalLinks.push(link);
          }
        }
      });
    });
  }

  getSheet(sheetName) {
    return this.sheets.get(sheetName);
  }

  getAllSheets() {
    return Array.from(this.sheets.values());
  }

  getNamedRange(name) {
    return this.namedRanges.get(name);
  }

  hasExternalLinks() {
    return this.externalLinks.length > 0;
  }

  hasHiddenSheets() {
    return Array.from(this.sheets.values()).some(s => s.isHidden || s.isVeryHidden);
  }
}

module.exports = { WorkbookParser };
