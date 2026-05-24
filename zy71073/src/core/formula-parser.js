class FormulaParser {
  constructor() {
    this.cellRefPattern = /\$?[A-Za-z]+\$?[0-9]+/;
    this.rangeRefPattern = /\$?[A-Za-z]+\$?[0-9]+:\$?[A-Za-z]+\$?[0-9]+/;
  }

  parseDependencies(formula, currentSheetName) {
    if (!formula) return [];

    const dependencies = new Set();
    let remaining = formula;

    const exclamations = [];
    for (let i = 0; i < formula.length; i++) {
      if (formula[i] === '!') exclamations.push(i);
    }

    for (const idx of exclamations) {
      const afterExcl = formula.substring(idx + 1);
      const rangeMatch = afterExcl.match(this.rangeRefPattern);
      const cellMatch = afterExcl.match(this.cellRefPattern);

      let ref = null;
      let refLength = 0;

      if (rangeMatch && rangeMatch.index === 0) {
        ref = rangeMatch[0];
        refLength = ref.length;
      } else if (cellMatch && cellMatch.index === 0) {
        ref = cellMatch[0];
        refLength = ref.length;
      }

      if (ref) {
        let sheetName = null;
        const beforeExcl = formula.substring(0, idx);

        if (beforeExcl.endsWith("'")) {
          const lastQuote = beforeExcl.lastIndexOf("'", beforeExcl.length - 2);
          if (lastQuote >= 0) {
            sheetName = beforeExcl.substring(lastQuote + 1, beforeExcl.length - 1);
          }
        } else {
          const match = beforeExcl.match(/([A-Za-z0-9_\u4e00-\u9fa5]+)$/);
          if (match) {
            sheetName = match[1];
          }
        }

        if (sheetName) {
          this._addRangeDependencies(dependencies, sheetName, ref);
        }
      }
    }

    let cleanedFormula = formula;
    exclamations.forEach(idx => {
      const afterExcl = formula.substring(idx + 1);
      const rangeMatch = afterExcl.match(this.rangeRefPattern);
      const cellMatch = afterExcl.match(this.cellRefPattern);
      if (rangeMatch && rangeMatch.index === 0) {
        const start = idx - 100 > 0 ? idx - 100 : 0;
        cleanedFormula = cleanedFormula.substring(0, start) + ' ' + cleanedFormula.substring(idx + 1 + rangeMatch[0].length);
      } else if (cellMatch && cellMatch.index === 0) {
        const start = idx - 100 > 0 ? idx - 100 : 0;
        cleanedFormula = cleanedFormula.substring(0, start) + ' ' + cleanedFormula.substring(idx + 1 + cellMatch[0].length);
      }
    });

    const rangeRegex = new RegExp(this.rangeRefPattern.source, 'g');
    let rangeMatch;
    while ((rangeMatch = rangeRegex.exec(cleanedFormula)) !== null) {
      this._addRangeDependencies(dependencies, currentSheetName, rangeMatch[0]);
      cleanedFormula = cleanedFormula.replace(rangeMatch[0], ' ');
    }

    const funcRemoved = cleanedFormula.replace(/[A-Za-z0-9_]+\(/g, ' ');
    const cellRegex = new RegExp(this.cellRefPattern.source, 'g');
    let cellMatch;
    const seen = new Set();
    while ((cellMatch = cellRegex.exec(funcRemoved)) !== null) {
      const fullRef = `${currentSheetName}!${cellMatch[0].replace(/\$/g, '')}`;
      if (!seen.has(fullRef)) {
        dependencies.add(fullRef);
        seen.add(fullRef);
      }
    }

    return Array.from(dependencies);
  }

  _addRangeDependencies(dependencies, sheetName, rangeRef) {
    if (rangeRef.includes(':')) {
      const cells = this._expandRange(rangeRef);
      cells.forEach(cell => {
        dependencies.add(`${sheetName}!${cell}`);
      });
    } else {
      const cleanRef = rangeRef.replace(/\$/g, '');
      dependencies.add(`${sheetName}!${cleanRef}`);
    }
  }

  _expandRange(rangeRef) {
    const [start, end] = rangeRef.split(':').map(r => r.replace(/\$/g, ''));
    const startCell = this._parseCell(start);
    const endCell = this._parseCell(end);
    const cells = [];

    for (let col = startCell.col; col <= endCell.col; col++) {
      for (let row = startCell.row; row <= endCell.row; row++) {
        cells.push(`${this._colToLetter(col)}${row}`);
      }
    }

    return cells;
  }

  _parseCell(cellRef) {
    const match = cellRef.match(/^([A-Za-z]+)([0-9]+)$/);
    if (!match) return { col: 0, row: 0 };
    return {
      col: this._letterToCol(match[1]),
      row: parseInt(match[2], 10),
    };
  }

  _letterToCol(letters) {
    let col = 0;
    for (let i = 0; i < letters.length; i++) {
      col = col * 26 + (letters.toUpperCase().charCodeAt(i) - 64);
    }
    return col;
  }

  _colToLetter(col) {
    let letters = '';
    let temp = col;
    while (temp > 0) {
      const remainder = (temp - 1) % 26;
      letters = String.fromCharCode(65 + remainder) + letters;
      temp = Math.floor((temp - 1) / 26);
    }
    return letters;
  }
}

module.exports = { FormulaParser };
