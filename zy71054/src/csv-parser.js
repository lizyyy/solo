const fs = require('fs');
const { StringDecoder } = require('string_decoder');

const COMMON_DELIMITERS = [',', '\t', ';', '|', '^', '\u0001'];

function inferDelimiter(content, sampleLines = 50) {
  const lines = content.split(/\r?\n/).slice(0, sampleLines).filter(l => l.trim().length > 0);
  
  if (lines.length === 0) {
    return { delimiter: ',', confidence: 0, candidates: [] };
  }

  const candidates = [];

  for (const delimiter of COMMON_DELIMITERS) {
    const counts = lines.map(line => countDelimiter(line, delimiter));
    const nonZeroCounts = counts.filter(c => c > 0);
    
    if (nonZeroCounts.length === 0) continue;

    const avg = nonZeroCounts.reduce((a, b) => a + b, 0) / nonZeroCounts.length;
    const variance = nonZeroCounts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / nonZeroCounts.length;
    const consistency = 1 / (1 + variance);
    const coverage = nonZeroCounts.length / lines.length;
    const confidence = consistency * coverage * (avg > 1 ? 1 : 0.5);

    candidates.push({
      delimiter,
      confidence,
      avgColumns: avg,
      consistency,
      coverage
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);

  return {
    delimiter: candidates[0]?.delimiter || ',',
    confidence: candidates[0]?.confidence || 0,
    candidates: candidates.slice(0, 3)
  };
}

function countDelimiter(line, delimiter) {
  let count = 0;
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === delimiter && !inQuotes) {
      count++;
    }
  }
  
  return count;
}

function parseCSVLine(line, delimiter, options = {}) {
  const { strictQuotes = true } = options;
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  
  return result;
}

function parseCSVLazy(content, delimiter, options = {}) {
  const lines = splitLinesPreservingQuotes(content);
  const records = [];
  const badLines = [];
  let lineNumber = 0;
  let expectedColumns = null;

  for (const { line, originalLineNumbers } of lines) {
    lineNumber++;
    const actualLineNumber = originalLineNumbers[0];
    
    try {
      const columns = parseCSVLine(line, delimiter, options);
      
      if (expectedColumns === null && columns.length > 0) {
        expectedColumns = columns.length;
      }

      if (expectedColumns !== null && columns.length !== expectedColumns) {
        badLines.push({
          lineNumber: actualLineNumber,
          lineNumbers: originalLineNumbers,
          content: line,
          columnCount: columns.length,
          expectedColumns,
          type: 'column_count_mismatch',
          message: `列数不匹配: 期望 ${expectedColumns}, 实际 ${columns.length}`
        });
      }

      records.push({
        columns,
        lineNumber: actualLineNumber,
        lineNumbers: originalLineNumbers,
        isBad: expectedColumns !== null && columns.length !== expectedColumns
      });
    } catch (error) {
      badLines.push({
        lineNumber: actualLineNumber,
        lineNumbers: originalLineNumbers,
        content: line,
        type: 'parse_error',
        message: error.message
      });
    }
  }

  return { records, badLines, expectedColumns };
}

function splitLinesPreservingQuotes(content) {
  const result = [];
  let currentLine = '';
  let inQuotes = false;
  let lineNumber = 1;
  let currentLineNumbers = [1];

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        currentLine += '"';
      }
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      if (currentLine.length > 0 || result.length > 0) {
        result.push({ line: currentLine, originalLineNumbers: [...currentLineNumbers] });
      }
      currentLine = '';
      if (char === '\r') i++;
      lineNumber++;
      currentLineNumbers = [lineNumber];
    } else if (char === '\n' && inQuotes) {
      currentLine += '\n';
      lineNumber++;
      if (!currentLineNumbers.includes(lineNumber)) {
        currentLineNumbers.push(lineNumber);
      }
    } else if (char !== '\r') {
      currentLine += char;
    }
  }

  if (currentLine.length > 0) {
    result.push({ line: currentLine, originalLineNumbers: currentLineNumbers.length > 0 ? currentLineNumbers : [lineNumber] });
  }

  return result;
}

function detectDuplicateHeaders(headers) {
  const seen = new Map();
  const duplicates = [];

  headers.forEach((header, index) => {
    if (seen.has(header)) {
      duplicates.push({
        header,
        firstIndex: seen.get(header),
        secondIndex: index
      });
    } else {
      seen.set(header, index);
    }
  });

  return duplicates;
}

function applyHeaderAliases(headers, aliases = {}) {
  return headers.map(header => {
    const normalized = header.trim().toLowerCase();
    for (const key of Object.keys(aliases)) {
      if (key.toLowerCase() === normalized) {
        return aliases[key];
      }
    }
    return header.trim();
  });
}

function isEmptyFile(content) {
  return content.trim().length === 0;
}

module.exports = {
  inferDelimiter,
  parseCSVLine,
  parseCSVLazy,
  splitLinesPreservingQuotes,
  detectDuplicateHeaders,
  applyHeaderAliases,
  isEmptyFile,
  COMMON_DELIMITERS
};
