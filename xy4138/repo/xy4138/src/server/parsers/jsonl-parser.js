const fs = require('fs');
const readline = require('readline');
const { validateTelemetryData } = require('../protocols');

class JSONLParser {
  constructor(options = {}) {
    this.strictMode = options.strictMode !== false;
    this.encoding = options.encoding || 'utf-8';
    this.maxLines = options.maxLines || 100000;
  }

  async parseFile(filePath) {
    const records = [];
    const errors = [];
    const warnings = [];
    let lineNumber = 0;

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: this.encoding }),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      lineNumber++;
      
      if (records.length >= this.maxLines) {
        warnings.push(`Reached maximum line limit (${this.maxLines}), stopping parse`);
        break;
      }

      if (!line.trim()) continue;

      try {
        const record = JSON.parse(line);
        const validation = validateTelemetryData(record);
        
        if (!validation.valid) {
          const errorMsg = `Line ${lineNumber}: ${validation.errors.join(', ')}`;
          if (this.strictMode) {
            errors.push(errorMsg);
          } else {
            warnings.push(errorMsg);
          }
        }
        
        validation.warnings.forEach(w => {
          warnings.push(`Line ${lineNumber}: ${w}`);
        });

        if (validation.valid || !this.strictMode) {
          records.push({
            ...record,
            _lineNumber: lineNumber,
            _validation: validation
          });
        }
      } catch (e) {
        const errorMsg = `Line ${lineNumber}: JSON parse error - ${e.message}`;
        if (this.strictMode) {
          errors.push(errorMsg);
        } else {
          warnings.push(errorMsg);
        }
      }
    }

    return {
      records,
      errors,
      warnings,
      stats: {
        totalLines: lineNumber,
        validRecords: records.length,
        invalidRecords: lineNumber - records.length
      }
    };
  }

  parseString(content) {
    const lines = content.split(/\r?\n/);
    const records = [];
    const errors = [];
    const warnings = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      if (records.length >= this.maxLines) {
        warnings.push(`Reached maximum line limit (${this.maxLines}), stopping parse`);
        return;
      }

      if (!line.trim()) return;

      try {
        const record = JSON.parse(line);
        const validation = validateTelemetryData(record);
        
        if (!validation.valid) {
          const errorMsg = `Line ${lineNumber}: ${validation.errors.join(', ')}`;
          if (this.strictMode) {
            errors.push(errorMsg);
          } else {
            warnings.push(errorMsg);
          }
        }
        
        validation.warnings.forEach(w => {
          warnings.push(`Line ${lineNumber}: ${w}`);
        });

        if (validation.valid || !this.strictMode) {
          records.push({
            ...record,
            _lineNumber: lineNumber,
            _validation: validation
          });
        }
      } catch (e) {
        const errorMsg = `Line ${lineNumber}: JSON parse error - ${e.message}`;
        if (this.strictMode) {
          errors.push(errorMsg);
        } else {
          warnings.push(errorMsg);
        }
      }
    });

    return {
      records,
      errors,
      warnings,
      stats: {
        totalLines: lines.length,
        validRecords: records.length,
        invalidRecords: lines.length - records.length
      }
    };
  }

  async validateFile(filePath) {
    const result = await this.parseFile(filePath);
    return {
      isValid: result.errors.length === 0,
      errors: result.errors,
      warnings: result.warnings,
      stats: result.stats
    };
  }

  sortByTimestamp(records) {
    return [...records].sort((a, b) => {
      const tsA = a.timestamp || 0;
      const tsB = b.timestamp || 0;
      return tsA - tsB;
    });
  }

  getTimeRange(records) {
    if (records.length === 0) {
      return { start: null, end: null, duration: 0 };
    }

    const sorted = this.sortByTimestamp(records);
    const start = sorted[0].timestamp;
    const end = sorted[sorted.length - 1].timestamp;

    return {
      start,
      end,
      duration: end - start
    };
  }
}

module.exports = JSONLParser;
