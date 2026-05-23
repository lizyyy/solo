const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

class BaseParser {
  constructor(sourceType) {
    this.sourceType = sourceType;
  }

  readFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return {
      content: fs.readFileSync(filePath, 'utf8'),
      fileName: path.basename(filePath),
      fullPath: filePath
    };
  }

  parseCSV(content) {
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  }

  parseLines(content) {
    return content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  validateDate(dateStr) {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  normalizeDate(dateStr) {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  }

  extractRoomNumber(text) {
    const match = text.match(/(\d{3,4})[号房]?/);
    return match ? match[1] : null;
  }

  parse(filePath, operator) {
    throw new Error('parse() must be implemented by subclass');
  }
}

module.exports = { BaseParser };
