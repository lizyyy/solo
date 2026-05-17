const TimezoneProcessor = require('./timezone-processor');
const DataReader = require('./data-reader');

class AuditEngine {
  constructor(options = {}) {
    this.processor = new TimezoneProcessor(options);
    this.reader = new DataReader(options);
    this.targetTimezone = options.targetTimezone || 'UTC';
    this.timeField = options.timeField || 'timestamp';
    this.timezoneField = options.timezoneField || null;
    this.defaultSourceTimezone = options.defaultSourceTimezone || 'UTC';
    this.failFast = options.failFast || false;
  }

  async audit(inputPath) {
    const inputData = await this.reader.readInput(inputPath);
    const results = {
      meta: {
        inputPath,
        inputType: inputData.type,
        targetTimezone: this.targetTimezone,
        timeField: this.timeField,
        timezoneField: this.timezoneField,
        auditTime: new Date().toISOString()
      },
      summary: {
        totalRows: 0,
        successRows: 0,
        errorRows: 0,
        warningRows: 0,
        dstTransitionRows: 0,
        files: []
      },
      files: [],
      errors: [],
      warnings: []
    };

    if (inputData.type === 'directory') {
      for (const file of inputData.files) {
        const fileResult = await this.auditFile(file);
        results.files.push(fileResult);
        this.aggregateSummary(results.summary, fileResult.summary);
      }
    } else {
      const fileResult = await this.auditFile(inputData);
      results.files.push(fileResult);
      this.aggregateSummary(results.summary, fileResult.summary);
    }

    results.exitCode = results.summary.errorRows > 0 ? 1 : 0;
    return results;
  }

  aggregateSummary(summary, fileSummary) {
    summary.totalRows += fileSummary.totalRows;
    summary.successRows += fileSummary.successRows;
    summary.errorRows += fileSummary.errorRows;
    summary.warningRows += fileSummary.warningRows;
    summary.dstTransitionRows += fileSummary.dstTransitionRows;
    summary.files.push({
      file: fileSummary.file,
      ...fileSummary
    });
  }

  async auditFile(fileData) {
    const result = {
      file: fileData.file || fileData.path,
      filePath: fileData.filePath || fileData.path,
      format: fileData.format,
      headers: fileData.headers || [],
      summary: {
        file: fileData.file || fileData.path,
        totalRows: 0,
        successRows: 0,
        errorRows: 0,
        warningRows: 0,
        dstTransitionRows: 0
      },
      rows: [],
      errors: [],
      warnings: []
    };

    if (!fileData.success) {
      result.summary.errorRows = 1;
      result.errors.push({
        type: 'FILE_READ_ERROR',
        message: fileData.error,
        file: result.file
      });
      return result;
    }

    result.summary.totalRows = fileData.rowCount;

    for (let index = 0; index < fileData.rows.length; index++) {
      const row = fileData.rows[index];
      const rowResult = this.auditRow(row, index, fileData.headers);
      result.rows.push(rowResult);

      if (rowResult.status === 'error') {
        result.summary.errorRows++;
        result.errors.push(rowResult);
      } else if (rowResult.status === 'warning') {
        result.summary.warningRows++;
        result.warnings.push(rowResult);
        if (rowResult.dstTransition) {
          result.summary.dstTransitionRows++;
        }
      } else {
        result.summary.successRows++;
        if (rowResult.dstTransition) {
          result.summary.dstTransitionRows++;
        }
      }

      if (this.failFast && rowResult.status === 'error') {
        break;
      }
    }

    return result;
  }

  auditRow(row, rowIndex, headers) {
    const timeValue = row[this.timeField];
    let sourceTimezone = this.defaultSourceTimezone;
    if (this.timezoneField && row[this.timezoneField] && row[this.timezoneField].trim() !== '') {
      sourceTimezone = row[this.timezoneField];
    }

    const result = {
      rowIndex,
      rowNumber: rowIndex + 2,
      originalRow: { ...row },
      status: 'success',
      issues: [],
      dstTransition: false
    };

    if (!timeValue && timeValue !== 0) {
      result.status = 'error';
      result.issues.push({
        type: 'MISSING_TIME_FIELD',
        message: `时间字段 "${this.timeField}" 为空或不存在`,
        field: this.timeField
      });
      return result;
    }

    const normalizeResult = this.processor.normalize(timeValue, sourceTimezone, this.targetTimezone);

    if (!normalizeResult.success) {
      result.status = 'error';
      result.issues.push({
        type: normalizeResult.error,
        message: normalizeResult.message,
        value: timeValue,
        sourceTimezone
      });
      return result;
    }

    result.normalized = {
      isoString: normalizeResult.normalized.isoString,
      timezone: normalizeResult.normalized.timezone,
      offset: normalizeResult.normalized.offset,
      offsetName: normalizeResult.normalized.offsetName,
      utcTimestamp: normalizeResult.utcTimestamp
    };

    result.original = normalizeResult.original;

    if (normalizeResult.dstInfo && normalizeResult.dstInfo.isDstTransitionPoint) {
      result.dstTransition = true;
      result.status = 'warning';
      result.issues.push({
        type: 'DST_TRANSITION',
        message: `该时间点位于夏令时转换边界 (${normalizeResult.dstInfo.isSpringForward ? '时钟拨快' : '时钟拨回'})`,
        dstInfo: {
          offsetBefore: normalizeResult.dstInfo.offsetBefore,
          currentOffset: normalizeResult.dstInfo.currentOffset,
          offsetAfter: normalizeResult.dstInfo.offsetAfter,
          offsetChange: normalizeResult.dstInfo.offsetChange
        }
      });
    }

    if (this.timezoneField && !row[this.timezoneField]) {
      result.status = 'warning';
      result.issues.push({
        type: 'MISSING_TIMEZONE_FIELD',
        message: `时区字段 "${this.timezoneField}" 为空，使用默认时区`,
        usedTimezone: this.defaultSourceTimezone
      });
    }

    return result;
  }

  getFailedRows(results) {
    const failedRows = [];
    
    for (const file of results.files) {
      for (const row of file.rows) {
        if (row.status === 'error') {
          failedRows.push({
            file: file.file,
            filePath: file.filePath,
            ...row
          });
        }
      }
    }
    
    return failedRows;
  }

  getWarningRows(results) {
    const warningRows = [];
    
    for (const file of results.files) {
      for (const row of file.rows) {
        if (row.status === 'warning') {
          warningRows.push({
            file: file.file,
            filePath: file.filePath,
            ...row
          });
        }
      }
    }
    
    return warningRows;
  }
}

module.exports = AuditEngine;