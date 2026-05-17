class FormulaParser {
  constructor() {
    this.referencePatterns = {
      cellRef: /([A-Za-z_][A-Za-z0-9_]*)!(\$?[A-Za-z]+\$?\d+)/g,
      rangeRef: /([A-Za-z_][A-Za-z0-9_]*)!(\$?[A-Za-z]+\$?\d+):(\$?[A-Za-z]+\$?\d+)/g,
      namedRange: /([A-Za-z_][A-Za-z0-9_]*)!/g
    };
  }

  parseFormula(formula, currentSheet) {
    if (!formula || typeof formula !== 'string' || !formula.startsWith('=')) {
      return { hasFormula: false, references: [] };
    }

    const references = [];
    const seenRefs = new Set();

    const formulaBody = formula.substring(1);

    let match;
    const rangePattern = /'?([^'!]+)'?!(\$?[A-Za-z]+\$?\d+):(\$?[A-Za-z]+\$?\d+)/g;
    while ((match = rangePattern.exec(formulaBody)) !== null) {
      const refKey = match[0];
      if (!seenRefs.has(refKey)) {
        seenRefs.add(refKey);
        references.push({
          type: 'range',
          raw: match[0],
          sheetName: match[1].replace(/^'|'$/g, ''),
          startCell: match[2],
          endCell: match[3],
          currentSheet
        });
      }
    }

    const cellPattern = /'?([^'!]+)'?!(\$?[A-Za-z]+\$?\d+)(?!:)/g;
    while ((match = cellPattern.exec(formulaBody)) !== null) {
      const refKey = match[0];
      if (!seenRefs.has(refKey)) {
        seenRefs.add(refKey);
        references.push({
          type: 'cell',
          raw: match[0],
          sheetName: match[1].replace(/^'|'$/g, ''),
          cell: match[2],
          currentSheet
        });
      }
    }

    return {
      hasFormula: true,
      formula,
      references
    };
  }

  parseCellAddress(address) {
    const match = address.match(/(\$?)([A-Za-z]+)(\$?)(\d+)/);
    if (!match) return null;
    
    const colStr = match[2].toUpperCase();
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    
    return {
      col,
      row: parseInt(match[4], 10),
      colFixed: match[1] === '$',
      rowFixed: match[3] === '$',
      colStr
    };
  }

  isWithinRange(cell, rangeStart, rangeEnd) {
    const cellAddr = this.parseCellAddress(cell);
    const startAddr = this.parseCellAddress(rangeStart);
    const endAddr = this.parseCellAddress(rangeEnd);
    
    if (!cellAddr || !startAddr || !endAddr) return false;
    
    const minCol = Math.min(startAddr.col, endAddr.col);
    const maxCol = Math.max(startAddr.col, endAddr.col);
    const minRow = Math.min(startAddr.row, endAddr.row);
    const maxRow = Math.max(startAddr.row, endAddr.row);
    
    return cellAddr.col >= minCol && cellAddr.col <= maxCol &&
           cellAddr.row >= minRow && cellAddr.row <= maxRow;
  }
}

module.exports = FormulaParser;
