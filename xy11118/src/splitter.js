const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { RECORD_TYPES } = require('./constants');
const AuditLogger = require('./auditLogger');

class MealSubsidySplitter {
  constructor(config, auditDir) {
    this.config = config;
    this.auditLogger = new AuditLogger(auditDir);
    this.records = [];
    this.classifiedRecords = {
      [RECORD_TYPES.NORMAL]: [],
      [RECORD_TYPES.CROSS_MONTH_REFUND]: [],
      [RECORD_TYPES.RESIGNED_EMPLOYEE]: [],
      [RECORD_TYPES.RERUN_OUTPUT]: []
    };
  }

  async loadInputFile(inputPath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(inputPath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          this.records = results;
          resolve(results.length);
        })
        .on('error', reject);
    });
  }

  isCrossMonthRefund(record) {
    const { transactionDate, originalMonth } = record;
    if (!transactionDate || !originalMonth) return false;
    
    const transMonth = transactionDate.substring(0, 7);
    const origMonth = originalMonth.substring(0, 7);
    
    const isRefund = parseFloat(record.amount || 0) < 0;
    const isCrossMonth = transMonth !== origMonth;
    
    return isRefund && isCrossMonth;
  }

  isResignedEmployee(record) {
    const { employeeStatus, resignationDate, transactionDate } = record;
    
    if (employeeStatus === '已离职') return true;
    
    if (resignationDate && transactionDate) {
      return new Date(transactionDate) >= new Date(resignationDate);
    }
    
    return false;
  }

  isRerunOutput(record) {
    const { processTag, processedAt, rerunFlag } = record;
    return processTag === 'RE-RUN' || rerunFlag === 'Y' || rerunFlag === true;
  }

  classifyRecord(record, index) {
    const recordId = record.transactionId || `REC-${index + 1}`;
    let recordType = RECORD_TYPES.NORMAL;
    let reason = '正常交易';

    if (this.isCrossMonthRefund(record)) {
      recordType = RECORD_TYPES.CROSS_MONTH_REFUND;
      reason = `跨月退款: 交易月份${record.transactionDate?.substring(0, 7)}，原月份${record.originalMonth?.substring(0, 7)}`;
      this.auditLogger.logSpecialCaseDetected(recordId, 'cross_month_refund', reason);
    } else if (this.isResignedEmployee(record)) {
      recordType = RECORD_TYPES.RESIGNED_EMPLOYEE;
      reason = `离职员工: 员工${record.employeeName}, 状态${record.employeeStatus}`;
      this.auditLogger.logSpecialCaseDetected(recordId, 'resigned_employee', reason);
    } else if (this.isRerunOutput(record)) {
      recordType = RECORD_TYPES.RERUN_OUTPUT;
      reason = '复跑输出标记';
      this.auditLogger.logSpecialCaseDetected(recordId, 'rerun_output', reason);
    }

    this.classifiedRecords[recordType].push({
      ...record,
      _recordId: recordId,
      _classifiedAt: new Date().toISOString(),
      _classificationReason: reason
    });

    this.auditLogger.logRecordClassified(recordId, 'unclassified', recordType, reason);

    return recordType;
  }

  applySubsidyRules(record) {
    const { subsidyRules } = this.config;
    let finalAmount = parseFloat(record.amount || 0);
    let appliedRules = [];

    if (subsidyRules.dailyLimit && record.mealType === '午餐') {
      const limit = subsidyRules.dailyLimit.lunch;
      if (finalAmount > limit) {
        appliedRules.push(`午餐限额${limit}元`);
        finalAmount = Math.min(finalAmount, limit);
      }
    }

    if (subsidyRules.dinnerSubsidyRate && record.mealType === '晚餐') {
      const rate = subsidyRules.dinnerSubsidyRate;
      appliedRules.push(`晚餐补贴比例${rate * 100}%`);
      finalAmount = finalAmount * rate;
    }

    if (subsidyRules.maxMonthlySubsidy) {
      appliedRules.push(`月最高补贴${subsidyRules.maxMonthlySubsidy}元`);
    }

    return {
      finalAmount: finalAmount.toFixed(2),
      appliedRules,
      originalAmount: record.amount
    };
  }

  processRecords() {
    this.records.forEach((record, index) => {
      this.classifyRecord(record, index);
    });

    this.classifiedRecords[RECORD_TYPES.NORMAL] = this.classifiedRecords[RECORD_TYPES.NORMAL].map(record => {
      const subsidyResult = this.applySubsidyRules(record);
      return {
        ...record,
        _finalAmount: subsidyResult.finalAmount,
        _originalAmount: subsidyResult.originalAmount,
        _appliedRules: subsidyResult.appliedRules.join('; ')
      };
    });

    this.auditLogger.logRuleApplied('食堂餐补规则', this.config.subsidyRules, this.classifiedRecords[RECORD_TYPES.NORMAL].length);

    return this.getClassifiedCounts();
  }

  getClassifiedCounts() {
    return {
      total: this.records.length,
      normal: this.classifiedRecords[RECORD_TYPES.NORMAL].length,
      crossMonthRefund: this.classifiedRecords[RECORD_TYPES.CROSS_MONTH_REFUND].length,
      resignedEmployee: this.classifiedRecords[RECORD_TYPES.RESIGNED_EMPLOYEE].length,
      rerunOutput: this.classifiedRecords[RECORD_TYPES.RERUN_OUTPUT].length
    };
  }

  async writeOutput(outputDir) {
    const outputs = [
      { type: RECORD_TYPES.NORMAL, filename: 'normal-result.csv', desc: '正常结果' },
      { type: RECORD_TYPES.CROSS_MONTH_REFUND, filename: 'cross-month-refund.csv', desc: '跨月退款' },
      { type: RECORD_TYPES.RESIGNED_EMPLOYEE, filename: 'resigned-employee.csv', desc: '离职员工' },
      { type: RECORD_TYPES.RERUN_OUTPUT, filename: 'rerun-output.csv', desc: '复跑输出' }
    ];

    for (const output of outputs) {
      const records = this.classifiedRecords[output.type];
      if (records.length === 0) continue;

      const filePath = path.join(outputDir, output.filename);
      const headers = Object.keys(records[0]);
      
      const csvWriter = createCsvWriter({
        path: filePath,
        header: headers.map(h => ({ id: h, title: h }))
      });

      await csvWriter.writeRecords(records);
      this.auditLogger.logOutputGenerated(filePath, records.length);
    }

    await this.writeSummary(outputDir);
  }

  async writeSummary(outputDir) {
    const counts = this.getClassifiedCounts();
    const summary = {
      generatedAt: new Date().toISOString(),
      configName: this.config.name,
      ...counts,
      hasSpecialCases: counts.crossMonthRefund > 0 || counts.resignedEmployee > 0 || counts.rerunOutput > 0
    };

    const summaryPath = path.join(outputDir, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    this.auditLogger.logOutputGenerated(summaryPath, 1);
  }

  async process(inputPath, outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    this.auditLogger.logProcessStart(this.config.name, inputPath, outputDir);

    await this.loadInputFile(inputPath);
    const counts = this.processRecords();
    await this.writeOutput(outputDir);
    this.auditLogger.logProcessEnd(this.records.length, counts);

    return {
      counts,
      auditFile: this.auditLogger.getAuditFilePath(),
      hasSpecialCases: counts.crossMonthRefund > 0 || counts.resignedEmployee > 0 || counts.rerunOutput > 0
    };
  }
}

module.exports = MealSubsidySplitter;
