class FormulaParser {
  constructor() {
    this.cellRefPattern = /\$?[A-Za-z]+\$?[0-9]+/g;
    this.rangeRefPattern = /\$?[A-Za-z]+\$?[0-9]+:\$?[A-Za-z]+\$?[0-9]+/g;
    this.crossSheetCellPattern = /'([^']+)'!(\$?[A-Za-z]+\$?[0-9]+)(?::(\$?[A-Za-z]+\$?[0-9]+))?/g;
  }

  parseDependencies(formula, currentSheetName, namedRanges = []) {
    if (!formula) return [];

    const dependencies = new Set();
    const crossSheetRefs = this._extractCrossSheetRefs(formula);

    let cleanedFormula = formula;
    crossSheetRefs.sort((a, b) => b.endIndex - a.endIndex);
    crossSheetRefs.forEach(ref => {
      this._addRangeDependencies(dependencies, ref.sheetName, ref.cellRef);
      cleanedFormula = cleanedFormula.substring(0, ref.startIndex) + ' '.repeat(ref.endIndex - ref.startIndex) + cleanedFormula.substring(ref.endIndex);
    });

    const rangeRegex = this.rangeRefPattern;
    let match;
    while ((match = rangeRegex.exec(cleanedFormula)) !== null) {
      this._addRangeDependencies(dependencies, currentSheetName, match[0]);
    }

    cleanedFormula = cleanedFormula.replace(this.rangeRefPattern, ' ');
    const funcRemoved = cleanedFormula.replace(/[A-Za-z0-9_\u4e00-\u9fa5]+\(/g, ' ');

    const cellRegex = this.cellRefPattern;
    while ((match = cellRegex.exec(funcRemoved)) !== null) {
      const cleanRef = match[0].replace(/\$/g, '');
      dependencies.add(`${currentSheetName}!${cleanRef}`);
    }

    if (namedRanges && namedRanges.length > 0) {
      const namedRangeMap = new Map();
      namedRanges.forEach(nr => {
        namedRangeMap.set(nr.name, nr);
      });

      const potentialNames = cleanedFormula.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
      potentialNames.forEach(name => {
        const namedRange = namedRangeMap.get(name);
        if (namedRange) {
          const ref = namedRange.reference;
          const parts = ref.split('!');
          if (parts.length > 1) {
            this._addRangeDependencies(dependencies, parts[0].replace(/'/g, ''), parts[1]);
          } else {
            this._addRangeDependencies(dependencies, namedRange.sheetName, ref);
          }
        }
      });
    }

    return Array.from(dependencies);
  }

  _extractCrossSheetRefs(formula) {
    const refs = [];
    const cellRefPattern = /\$?[A-Za-z]+\$?[0-9]+/;
    const rangeRefPattern = /\$?[A-Za-z]+\$?[0-9]+:\$?[A-Za-z]+\$?[0-9]+/;

    for (let i = 0; i < formula.length; i++) {
      if (formula[i] !== '!') continue;

      const afterExcl = formula.substring(i + 1);
      const rangeMatch = afterExcl.match(rangeRefPattern);
      const cellMatch = afterExcl.match(cellRefPattern);

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
        let beforeExcl = formula.substring(0, i);
        let sheetStartIndex = -1;

        if (beforeExcl.endsWith("'")) {
          const lastQuote = beforeExcl.lastIndexOf("'", beforeExcl.length - 2);
          if (lastQuote >= 0) {
            sheetName = beforeExcl.substring(lastQuote + 1, beforeExcl.length - 1);
            sheetStartIndex = lastQuote;
          }
        } else {
          const match = beforeExcl.match(/([^\s+\-*/%^&=<>!(),:]+)$/);
          if (match) {
            sheetName = match[1];
            sheetStartIndex = beforeExcl.length - sheetName.length;
          }
        }

        if (sheetName) {
          refs.push({
            sheetName,
            cellRef: ref,
            startIndex: sheetStartIndex,
            endIndex: i + 1 + refLength,
          });
        }
      }
    }

    return refs;
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
