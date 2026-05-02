const fs = require('fs');
const csv = require('csv-parser');
const { CommandType, CommandStatus } = require('../protocols');

class CSVParser {
  constructor(options = {}) {
    this.strictMode = options.strictMode !== false;
    this.encoding = options.encoding || 'utf-8';
    this.maxRecords = options.maxRecords || 100000;
    this.delimiter = options.delimiter || ',';
  }

  async parseFile(filePath) {
    const records = [];
    const errors = [];
    const warnings = [];
    let lineNumber = 0;

    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: this.encoding })
        .pipe(csv({ separator: this.delimiter }))
        .on('headers', () => {
          lineNumber = 1;
        })
        .on('data', (row) => {
          lineNumber++;
          
          if (records.length >= this.maxRecords) {
            warnings.push(`Reached maximum record limit (${this.maxRecords}), stopping parse`);
            stream.destroy();
            return;
          }

          try {
            const record = this._parseRow(row);
            const validation = this._validateRecord(record);
            
            if (!validation.valid) {
              const errorMsg = `Row ${lineNumber}: ${validation.errors.join(', ')}`;
              if (this.strictMode) {
                errors.push(errorMsg);
              } else {
                warnings.push(errorMsg);
              }
            }
            
            validation.warnings.forEach(w => {
              warnings.push(`Row ${lineNumber}: ${w}`);
            });

            if (validation.valid || !this.strictMode) {
              records.push({
                ...record,
                _lineNumber: lineNumber,
                _validation: validation
              });
            }
          } catch (e) {
            const errorMsg = `Row ${lineNumber}: Parse error - ${e.message}`;
            if (this.strictMode) {
              errors.push(errorMsg);
            } else {
              warnings.push(errorMsg);
            }
          }
        })
        .on('end', () => {
          resolve({
            records,
            errors,
            warnings,
            stats: {
              totalRows: lineNumber,
              validRecords: records.length,
              invalidRecords: lineNumber - records.length - 1
            }
          });
        })
        .on('error', (e) => {
          reject(e);
        });
    });
  }

  parseString(content) {
    const lines = content.split(/\r?\n/);
    if (lines.length < 2) {
      return {
        records: [],
        errors: ['CSV must have at least header and one data row'],
        warnings: [],
        stats: { totalRows: 0, validRecords: 0, invalidRecords: 0 }
      };
    }

    const headerLine = lines[0];
    const headers = headerLine.split(this.delimiter).map(h => h.trim());
    const records = [];
    const errors = [];
    const warnings = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const lineNumber = i + 1;
      
      if (records.length >= this.maxRecords) {
        warnings.push(`Reached maximum record limit (${this.maxRecords}), stopping parse`);
        break;
      }

      try {
        const values = line.split(this.delimiter).map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });

        const record = this._parseRow(row);
        const validation = this._validateRecord(record);
        
        if (!validation.valid) {
          const errorMsg = `Row ${lineNumber}: ${validation.errors.join(', ')}`;
          if (this.strictMode) {
            errors.push(errorMsg);
          } else {
            warnings.push(errorMsg);
          }
        }
        
        validation.warnings.forEach(w => {
          warnings.push(`Row ${lineNumber}: ${w}`);
        });

        if (validation.valid || !this.strictMode) {
          records.push({
            ...record,
            _lineNumber: lineNumber,
            _validation: validation
          });
        }
      } catch (e) {
        const errorMsg = `Row ${lineNumber}: Parse error - ${e.message}`;
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
        totalRows: lines.length,
        validRecords: records.length,
        invalidRecords: lines.length - records.length - 1
      }
    };
  }

  _parseRow(row) {
    return {
      timestamp: this._parseNumber(row.timestamp || row.Timestamp || row['timestamp']),
      sequence: this._parseNumber(row.sequence || row.Sequence || row['sequence']),
      command_type: this._parseString(row.command_type || row.CommandType || row['command_type']),
      linear_vel: this._parseNumber(row.linear_vel || row.LinearVel || row['linear_vel']),
      angular_vel: this._parseNumber(row.angular_vel || row.AngularVel || row['angular_vel']),
      status: this._parseString(row.status || row.Status || row['status']),
      target_x: this._parseNumber(row.target_x || row.TargetX),
      target_y: this._parseNumber(row.target_y || row.TargetY),
      target_theta: this._parseNumber(row.target_theta || row.TargetTheta),
      duration: this._parseNumber(row.duration || row.Duration),
      metadata: row.metadata ? this._safeParseJSON(row.metadata) : null
    };
  }

  _parseNumber(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  _parseString(value) {
    return value === undefined || value === null ? null : String(value).trim();
  }

  _safeParseJSON(str) {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }

  _validateRecord(record) {
    const errors = [];
    const warnings = [];

    if (record.timestamp === null) {
      errors.push('Missing or invalid timestamp');
    }

    if (record.sequence === null) {
      warnings.push('Missing sequence number');
    }

    if (record.command_type && !Object.values(CommandType).includes(record.command_type)) {
      warnings.push(`Unknown command type: ${record.command_type}`);
    }

    if (record.status && !Object.values(CommandStatus).includes(record.status)) {
      warnings.push(`Unknown command status: ${record.status}`);
    }

    if (record.command_type === CommandType.VELOCITY) {
      if (record.linear_vel === null) {
        warnings.push('Velocity command missing linear_vel');
      }
      if (record.angular_vel === null) {
        warnings.push('Velocity command missing angular_vel');
      }
    }

    if (record.command_type === CommandType.POSITION) {
      if (record.target_x === null || record.target_y === null) {
        warnings.push('Position command missing target coordinates');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
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

module.exports = CSVParser;
