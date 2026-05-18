const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const REQUIRED_FIELDS = [
  '租赁订单编号',
  '租客姓名',
  '房源地址',
  '租期开始日期',
  '租期结束日期',
  '租金金额',
  '续租状态',
  '扣款状态',
  '操作类型'
];

class LeaseConflictChecker {
  constructor(options = {}) {
    this.outputFile = options.outputFile || 'lease-conflict-report.json';
    this.overwrite = options.overwrite !== false;
    this.reset();
  }

  reset() {
    this.records = [];
    this.formatErrors = [];
    this.duplicateRenewals = [];
    this.overlappingLeases = [];
    this.manualRenewals = [];
    this.paymentFailures = [];
  }

  async check(inputDir) {
    this.reset();

    if (!fs.existsSync(inputDir)) {
      throw new Error(`输入目录不存在: ${inputDir}`);
    }

    const files = fs.readdirSync(inputDir)
      .filter(f => f.endsWith('.csv'))
      .map(f => path.join(inputDir, f));

    if (files.length === 0) {
      this.addFormatError(null, 0, '空目录', '输入目录中没有找到CSV文件');
      return this.generateReport();
    }

    for (const file of files) {
      await this.processFile(file);
    }

    this.detectDuplicateRenewals();
    this.detectOverlappingLeases();

    return this.generateReport();
  }

  async processFile(filePath) {
    const fileName = path.basename(filePath);
    let lineNumber = 1;

    try {
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv({ skipLines: 0 }))
          .on('headers', (headers) => {
            lineNumber++;
            const missingFields = REQUIRED_FIELDS.filter(f => !headers.includes(f));
            if (missingFields.length > 0) {
              this.addFormatError(fileName, 1, '缺少必填列', 
                `缺少列: ${missingFields.join(', ')}`);
            }
          })
          .on('data', (data) => {
            lineNumber++;
            results.push({ data, line: lineNumber });
          })
          .on('end', resolve)
          .on('error', reject);
      });

      for (const { data, line } of results) {
        this.validateRecord(data, fileName, line);
      }

    } catch (error) {
      this.addFormatError(fileName, lineNumber, '文件读取失败', error.message);
    }
  }

  validateRecord(data, fileName, lineNumber) {
    const errors = [];

    if (!data['租赁订单编号']) {
      errors.push('租赁订单编号为空');
    }

    if (!data['租期开始日期'] || !this.isValidDate(data['租期开始日期'])) {
      errors.push('租期开始日期无效或为空');
    }

    if (!data['租期结束日期'] || !this.isValidDate(data['租期结束日期'])) {
      errors.push('租期结束日期无效或为空');
    }

    if (!data['租金金额'] || isNaN(parseFloat(data['租金金额']))) {
      errors.push('租金金额无效');
    }

    if (errors.length > 0) {
      this.addFormatError(fileName, lineNumber, '记录格式错误', errors.join('; '), data);
      return;
    }

    const record = {
      ...data,
      _source: {
        fileName,
        lineNumber
      },
      _startDate: this.parseDate(data['租期开始日期']),
      _endDate: this.parseDate(data['租期结束日期'])
    };

    this.records.push(record);

    if (data['续租状态'] === '手动续租') {
      this.manualRenewals.push({
        type: '手动续租',
        租赁订单编号: data['租赁订单编号'],
        租客姓名: data['租客姓名'],
        房源地址: data['房源地址'],
        原始文件: fileName,
        行号: lineNumber
      });
    }

    if (data['扣款状态'] === '扣款失败') {
      this.paymentFailures.push({
        type: '扣款失败',
        租赁订单编号: data['租赁订单编号'],
        租客姓名: data['租客姓名'],
        房源地址: data['房源地址'],
        原始文件: fileName,
        行号: lineNumber
      });
    }
  }

  detectDuplicateRenewals() {
    const renewalMap = new Map();

    for (const record of this.records) {
      const key = `${record['租客姓名']}-${record['房源地址']}`;
      if (!renewalMap.has(key)) {
        renewalMap.set(key, []);
      }
      renewalMap.get(key).push(record);
    }

    for (const [key, group] of renewalMap) {
      if (group.length > 1) {
        const automaticCount = group.filter(r => r['续租状态'] === '自动续租').length;
        if (automaticCount > 1) {
          this.duplicateRenewals.push({
            type: '续租重复',
            租客姓名: group[0]['租客姓名'],
            房源地址: group[0]['房源地址'],
            重复续租数: automaticCount,
            涉及订单: group.map(r => ({
              租赁订单编号: r['租赁订单编号'],
              租期开始日期: r['租期开始日期'],
              租期结束日期: r['租期结束日期'],
              原始文件: r._source.fileName,
              行号: r._source.lineNumber
            }))
          });
        }
      }
    }
  }

  detectOverlappingLeases() {
    const detectedPairs = new Set();
    
    for (let i = 0; i < this.records.length; i++) {
      for (let j = i + 1; j < this.records.length; j++) {
        const r1 = this.records[i];
        const r2 = this.records[j];

        const pairKey = `${r1['租赁订单编号']}-${r2['租赁订单编号']}`;
        const reverseKey = `${r2['租赁订单编号']}-${r1['租赁订单编号']}`;
        
        if (r1['房源地址'] === r2['房源地址'] &&
            r1['租客姓名'] !== r2['租客姓名'] &&
            !detectedPairs.has(pairKey) &&
            !detectedPairs.has(reverseKey) &&
            this.isDateOverlap(r1._startDate, r1._endDate, r2._startDate, r2._endDate)) {
          
          detectedPairs.add(pairKey);
          this.overlappingLeases.push({
            type: '租期重叠',
            房源地址: r1['房源地址'],
            重叠租期: [
              {
                租赁订单编号: r1['租赁订单编号'],
                租客姓名: r1['租客姓名'],
                租期开始日期: r1['租期开始日期'],
                租期结束日期: r1['租期结束日期'],
                原始文件: r1._source.fileName,
                行号: r1._source.lineNumber
              },
              {
                租赁订单编号: r2['租赁订单编号'],
                租客姓名: r2['租客姓名'],
                租期开始日期: r2['租期开始日期'],
                租期结束日期: r2['租期结束日期'],
                原始文件: r2._source.fileName,
                行号: r2._source.lineNumber
              }
            ]
          });
        }
      }
    }
  }

  generateReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      toolName: '租赁订单文件自动续租冲突检测工具',
      summary: {
        totalFiles: this.records.length > 0 ? 
          new Set(this.records.map(r => r._source.fileName)).size : 0,
        validRecords: this.records.length,
        formatErrors: this.formatErrors.length,
        duplicateRenewals: this.duplicateRenewals.length,
        overlappingLeases: this.overlappingLeases.length,
        manualRenewals: this.manualRenewals.length,
        paymentFailures: this.paymentFailures.length,
        totalIssues: this.formatErrors.length + this.duplicateRenewals.length + 
          this.overlappingLeases.length + this.manualRenewals.length + this.paymentFailures.length
      },
      issues: {
        formatErrors: this.formatErrors,
        duplicateRenewals: this.duplicateRenewals,
        overlappingLeases: this.overlappingLeases,
        manualRenewals: this.manualRenewals,
        paymentFailures: this.paymentFailures
      }
    };

    let output = report;
    if (!this.overwrite && fs.existsSync(this.outputFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(this.outputFile, 'utf8'));
        output = this.mergeReports(existing, report);
      } catch (e) {
        output = report;
      }
    }

    fs.writeFileSync(this.outputFile, JSON.stringify(output, null, 2), 'utf8');
    return report;
  }

  mergeReports(oldReport, newReport) {
    return {
      ...newReport,
      previousRun: oldReport.generatedAt
    };
  }

  addFormatError(fileName, lineNumber, errorType, message, data = null) {
    this.formatErrors.push({
      type: '格式错误',
      errorType,
      原始文件: fileName,
      行号: lineNumber,
      消息: message,
      原始数据: data
    });
  }

  isValidDate(dateStr) {
    return !isNaN(this.parseDate(dateStr).getTime());
  }

  parseDate(dateStr) {
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/,
      /^(\d{4})\/(\d{2})\/(\d{2})$/,
      /^(\d{4})年(\d{1,2})月(\d{1,2})日$/
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        const [, year, month, day] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
    }
    return new Date(dateStr);
  }

  isDateOverlap(start1, end1, start2, end2) {
    return start1 <= end2 && start2 <= end1;
  }
}

module.exports = LeaseConflictChecker;