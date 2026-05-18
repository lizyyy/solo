const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class BucketValidator {
  constructor(configPath) {
    this.config = this.loadConfig(configPath);
    this.bucketRecords = new Map();
    this.exceptions = [];
    this.validRecords = [];
    this.sourceFile = '';
  }

  loadConfig(configPath) {
    const defaultConfig = path.join(__dirname, '../rules/default.json');
    const targetConfig = configPath || defaultConfig;
    if (fs.existsSync(targetConfig)) {
      return JSON.parse(fs.readFileSync(targetConfig, 'utf8'));
    }
    throw new Error(`配置文件不存在: ${targetConfig}`);
  }

  validateBucketNumber(bucketNum, rowData, lineNumber) {
    const errors = [];
    const { bucketNumberRules } = this.config.validation;

    if (!bucketNum && bucketNumberRules.required) {
      errors.push({
        type: 'MISSING_BUCKET_NUMBER',
        message: '桶号为空',
        source: {
          file: this.sourceFile,
          line: lineNumber,
          column: 'bucket_number',
          value: bucketNum
        }
      });
    }

    if (bucketNum) {
      const pattern = new RegExp(bucketNumberRules.format.pattern);
      if (!pattern.test(bucketNum)) {
        errors.push({
          type: 'INVALID_FORMAT',
          message: `桶号格式不符合要求，应为${bucketNumberRules.format.description}`,
          source: {
            file: this.sourceFile,
            line: lineNumber,
            column: 'bucket_number',
            value: bucketNum
          }
        });
      }
    }

    return errors;
  }

  checkDuplicate(bucketNum, rowData, lineNumber) {
    const errors = [];
    const { duplicateDetection } = this.config.validation;

    if (this.bucketRecords.has(bucketNum)) {
      const existingRecord = this.bucketRecords.get(bucketNum);
      
      if (duplicateDetection.checkSameDay && 
          existingRecord.date === rowData.date &&
          existingRecord.station_code === rowData.station_code) {
        errors.push({
          type: 'DUPLICATE_BUCKET_SAME_DAY',
          message: `同一水站同一天桶号重复`,
          source: {
            file: this.sourceFile,
            line: lineNumber,
            column: 'bucket_number',
            value: bucketNum
          },
          detail: {
            existingLine: existingRecord.lineNumber,
            existingRecord: existingRecord
          }
        });
      }

      if (duplicateDetection.checkInTransit && 
          existingRecord.status === 'in_transit' &&
          rowData.status === 'in_transit') {
        errors.push({
          type: 'DUPLICATE_IN_TRANSIT',
          message: `桶号已在配送中，不能重复标记为配送中`,
          source: {
            file: this.sourceFile,
            line: lineNumber,
            column: 'status',
            value: rowData.status
          },
          detail: {
            existingLine: existingRecord.lineNumber,
            existingRecord: existingRecord
          }
        });
      }
    }

    return errors;
  }

  validateDriverEntry(rowData, lineNumber) {
    const errors = [];
    const { driverEntryRules } = this.config.validation;

    if (rowData.entry_type === 'driver_supplement') {
      if (!rowData.driver_id && driverEntryRules.requireDriverId) {
        errors.push({
          type: 'DRIVER_SUPPLEMENT_WITHOUT_ID',
          message: '司机补录必须填写司机ID',
          source: {
            file: this.sourceFile,
            line: lineNumber,
            column: 'driver_id',
            value: rowData.driver_id
          }
        });
      }

      const supplementTime = new Date(rowData.supplement_time);
      const deliveryDate = new Date(rowData.date);
      const hoursDiff = (supplementTime - deliveryDate) / (1000 * 60 * 60);

      if (hoursDiff > driverEntryRules.maxSupplementHours) {
        errors.push({
          type: 'SUPPLEMENT_EXCEED_TIME',
          message: `补录时间超过配送日期${driverEntryRules.maxSupplementHours}小时`,
          source: {
            file: this.sourceFile,
            line: lineNumber,
            column: 'supplement_time',
            value: rowData.supplement_time
          },
          detail: {
            hoursDiff: Math.round(hoursDiff * 10) / 10,
            maxAllowed: driverEntryRules.maxSupplementHours
          }
        });
      }

      if (!rowData.supplement_reason || 
          !driverEntryRules.validReasons.includes(rowData.supplement_reason)) {
        errors.push({
          type: 'INVALID_SUPPLEMENT_REASON',
          message: '补录原因不合法',
          source: {
            file: this.sourceFile,
            line: lineNumber,
            column: 'supplement_reason',
            value: rowData.supplement_reason
          },
          detail: {
            validReasons: driverEntryRules.validReasons
          }
        });
      }
    }

    return errors;
  }

  validateStatusTransition(rowData, lineNumber) {
    const errors = [];
    const { statusTransition } = this.config.validation;

    if (this.bucketRecords.has(rowData.bucket_number)) {
      const existingRecord = this.bucketRecords.get(rowData.bucket_number);
      const fromStatus = existingRecord.status;
      const toStatus = rowData.status;

      const allowedTransitions = statusTransition.rules[fromStatus] || [];
      if (!allowedTransitions.includes(toStatus)) {
        errors.push({
          type: 'INVALID_STATUS_TRANSITION',
          message: `状态流转不合法: ${fromStatus} -> ${toStatus}`,
          source: {
            file: this.sourceFile,
            line: lineNumber,
            column: 'status',
            value: rowData.status
          },
          detail: {
            fromStatus,
            toStatus,
            allowedTransitions
          }
        });
      }
    }

    return errors;
  }

  async validateFile(filePath) {
    this.sourceFile = path.basename(filePath);
    this.bucketRecords.clear();
    this.exceptions = [];
    this.validRecords = [];

    return new Promise((resolve, reject) => {
      const results = [];
      let lineNumber = 1;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          lineNumber++;
          results.push({ ...data, _lineNumber: lineNumber, _sourceFile: this.sourceFile });
        })
        .on('end', () => {
          results.forEach((row) => {
            this.processRow(row);
          });
          resolve({
            totalRecords: results.length,
            validRecords: this.validRecords.length,
            exceptions: this.exceptions,
            sourceFile: this.sourceFile
          });
        })
        .on('error', reject);
    });
  }

  processRow(row) {
    const lineNumber = row._lineNumber;
    const errors = [];

    errors.push(...this.validateBucketNumber(row.bucket_number, row, lineNumber));
    errors.push(...this.checkDuplicate(row.bucket_number, row, lineNumber));
    errors.push(...this.validateDriverEntry(row, lineNumber));
    errors.push(...this.validateStatusTransition(row, lineNumber));

    if (errors.length > 0) {
      this.exceptions.push({
        lineNumber,
        sourceFile: this.sourceFile,
        rowData: row,
        errors
      });
    } else {
      this.validRecords.push(row);
      if (row.bucket_number) {
        this.bucketRecords.set(row.bucket_number, {
          ...row,
          lineNumber
        });
      }
    }
  }

  generateExceptionReport(outputPath) {
    const reportData = this.exceptions.map(ex => ({
      line_number: ex.lineNumber,
      source_file: ex.sourceFile,
      bucket_number: ex.rowData.bucket_number || '',
      station_code: ex.rowData.station_code || '',
      driver_id: ex.rowData.driver_id || '',
      date: ex.rowData.date || '',
      status: ex.rowData.status || '',
      entry_type: ex.rowData.entry_type || '',
      error_count: ex.errors.length,
      error_types: ex.errors.map(e => e.type).join('; '),
      error_messages: ex.errors.map(e => 
        `${e.type}: ${e.message} [列:${e.source.column}, 值:${e.source.value}]`
      ).join(' | ')
    }));

    const csvWriter = createCsvWriter({
      path: outputPath,
      header: [
        {id: 'line_number', title: '原始行号'},
        {id: 'source_file', title: '源文件名'},
        {id: 'bucket_number', title: '桶号'},
        {id: 'station_code', title: '水站编码'},
        {id: 'driver_id', title: '司机ID'},
        {id: 'date', title: '配送日期'},
        {id: 'status', title: '状态'},
        {id: 'entry_type', title: '录入类型'},
        {id: 'error_count', title: '异常数量'},
        {id: 'error_types', title: '异常类型'},
        {id: 'error_messages', title: '异常详情'}
      ]
    });

    return csvWriter.writeRecords(reportData);
  }

  generateValidRecords(outputPath) {
    const csvWriter = createCsvWriter({
      path: outputPath,
      header: [
        {id: '_lineNumber', title: '原始行号'},
        {id: '_sourceFile', title: '源文件名'},
        {id: 'date', title: '配送日期'},
        {id: 'station_code', title: '水站编码'},
        {id: 'station_name', title: '水站名称'},
        {id: 'bucket_number', title: '桶号'},
        {id: 'bucket_type', title: '桶类型'},
        {id: 'driver_id', title: '司机ID'},
        {id: 'driver_name', title: '司机姓名'},
        {id: 'status', title: '状态'},
        {id: 'entry_type', title: '录入类型'},
        {id: 'supplement_time', title: '补录时间'},
        {id: 'supplement_reason', title: '补录原因'},
        {id: 'customer_id', title: '客户ID'},
        {id: 'customer_address', title: '客户地址'},
        {id: 'delivery_count', title: '配送数量'},
        {id: 'return_count', title: '回收数量'},
        {id: 'remark', title: '备注'}
      ]
    });

    return csvWriter.writeRecords(this.validRecords);
  }

  getStatistics() {
    const stats = {
      totalRecords: this.validRecords.length + this.exceptions.length,
      validRecords: this.validRecords.length,
      exceptionRecords: this.exceptions.length,
      exceptionByType: {},
      topExceptions: []
    };

    this.exceptions.forEach(ex => {
      ex.errors.forEach(err => {
        stats.exceptionByType[err.type] = (stats.exceptionByType[err.type] || 0) + 1;
      });
    });

    stats.topExceptions = Object.entries(stats.exceptionByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return stats;
  }
}

module.exports = BucketValidator;
