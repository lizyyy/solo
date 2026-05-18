const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class MealCouponAuditor {
  constructor(rulesPath) {
    this.rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    this.reset();
  }

  reset() {
    this.results = {
      summary: {
        totalRecords: 0,
        formatErrors: 0,
        crossDayUploads: 0,
        levelChanges: 0,
        duplicateRuns: 0,
        normalRecords: 0
      },
      formatErrors: [],
      crossDayUploads: [],
      levelChanges: [],
      duplicateRuns: [],
      couponHistory: new Map(),
      couponLevels: new Map()
    };
  }

  validateDate(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
  }

  calculateDaysDiff(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  validateRecord(record, lineNumber, filename) {
    const errors = [];
    const { 必填字段, 服务等级有效值 } = this.rules;

    for (const field of 必填字段) {
      if (!record[field] || String(record[field]).trim() === '') {
        errors.push(`必填字段缺失: ${field}`);
      }
    }

    if (record['核销日期'] && !this.validateDate(record['核销日期'])) {
      errors.push(`核销日期格式错误: ${record['核销日期']}`);
    }

    if (record['上传日期'] && !this.validateDate(record['上传日期'])) {
      errors.push(`上传日期格式错误: ${record['上传日期']}`);
    }

    if (record['服务等级'] && !服务等级有效值.includes(record['服务等级'])) {
      errors.push(`服务等级无效: ${record['服务等级']}`);
    }

    if (errors.length > 0) {
      this.results.formatErrors.push({
        filename,
        lineNumber,
        record,
        errors
      });
      this.results.summary.formatErrors++;
      return false;
    }

    return true;
  }

  detectCrossDayUpload(record, lineNumber, filename) {
    const daysDiff = this.calculateDaysDiff(record['核销日期'], record['上传日期']);
    if (daysDiff > this.rules.跨日补传天数阈值) {
      this.results.crossDayUploads.push({
        filename,
        lineNumber,
        couponNo: record['助餐券号'],
        verificationDate: record['核销日期'],
        uploadDate: record['上传日期'],
        daysDiff,
        record
      });
      this.results.summary.crossDayUploads++;
      return true;
    }
    return false;
  }

  detectLevelChange(record, lineNumber, filename) {
    const couponNo = record['助餐券号'];
    const currentLevel = record['服务等级'];
    
    if (this.results.couponLevels.has(couponNo)) {
      const previousLevel = this.results.couponLevels.get(couponNo);
      if (previousLevel !== currentLevel) {
        this.results.levelChanges.push({
          filename,
          lineNumber,
          couponNo,
          previousLevel,
          currentLevel,
          record
        });
        this.results.summary.levelChanges++;
        return true;
      }
    } else {
      this.results.couponLevels.set(couponNo, currentLevel);
    }
    return false;
  }

  detectDuplicateRun(record, lineNumber, filename) {
    const couponNo = record['助餐券号'];
    const verificationDate = record['核销日期'];
    const key = `${couponNo}-${verificationDate}`;

    if (this.results.couponHistory.has(key)) {
      const previousRecord = this.results.couponHistory.get(key);
      this.results.duplicateRuns.push({
        filename,
        lineNumber,
        couponNo,
        verificationDate,
        previousLine: previousRecord.lineNumber,
        previousFile: previousRecord.filename,
        record,
        previousRecord: previousRecord.record
      });
      this.results.summary.duplicateRuns++;
      return true;
    } else {
      this.results.couponHistory.set(key, {
        filename,
        lineNumber,
        record
      });
    }
    return false;
  }

  async auditFile(filePath) {
    const filename = path.basename(filePath);
    let lineNumber = 1;

    return new Promise((resolve, reject) => {
      const records = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', () => {
          lineNumber = 2;
        })
        .on('data', (data) => {
          records.push({ data, lineNumber });
          lineNumber++;
        })
        .on('end', () => {
          for (const { data, lineNumber: ln } of records) {
            this.results.summary.totalRecords++;
            
            if (!this.validateRecord(data, ln, filename)) {
              continue;
            }

            let hasIssue = false;
            hasIssue = this.detectCrossDayUpload(data, ln, filename) || hasIssue;
            hasIssue = this.detectLevelChange(data, ln, filename) || hasIssue;
            hasIssue = this.detectDuplicateRun(data, ln, filename) || hasIssue;

            if (!hasIssue) {
              this.results.summary.normalRecords++;
            }
          }
          resolve();
        })
        .on('error', reject);
    });
  }

  async auditPath(inputPath) {
    this.reset();
    const stats = fs.statSync(inputPath);

    if (stats.isFile()) {
      await this.auditFile(inputPath);
    } else if (stats.isDirectory()) {
      const files = fs.readdirSync(inputPath)
        .filter(f => f.endsWith('.csv'))
        .map(f => path.join(inputPath, f));
      
      for (const file of files) {
        await this.auditFile(file);
      }
    }

    return this.getResults();
  }

  getResults() {
    return {
      summary: { ...this.results.summary },
      details: {
        formatErrors: this.results.formatErrors,
        crossDayUploads: this.results.crossDayUploads,
        levelChanges: this.results.levelChanges,
        duplicateRuns: this.results.duplicateRuns
      }
    };
  }

  generateReport(results, outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(outputDir, `audit-report-${timestamp}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
    
    const summaryPath = path.join(outputDir, `audit-summary-${timestamp}.txt`);
    const summaryText = this.formatSummaryText(results);
    fs.writeFileSync(summaryPath, summaryText, 'utf8');

    return { reportPath, summaryPath };
  }

  formatSummaryText(results) {
    const { summary, details } = results;
    let text = `
=======================================
  公益助餐点助餐券核销稽核报告
=======================================

【统计概览】
总记录数: ${summary.totalRecords}
正常记录: ${summary.normalRecords}
异常记录: ${summary.formatErrors + summary.crossDayUploads + summary.levelChanges + summary.duplicateRuns}

【异常分类统计】
格式错误: ${summary.formatErrors} 条
跨日补传: ${summary.crossDayUploads} 条
等级变更: ${summary.levelChanges} 条
可复跑输出: ${summary.duplicateRuns} 条

`;

    if (details.formatErrors.length > 0) {
      text += `
【格式错误详情】
${details.formatErrors.map(e => `  行${e.lineNumber} [${e.filename}]: ${e.errors.join(', ')}`).join('\n')}
`;
    }

    if (details.crossDayUploads.length > 0) {
      text += `
【跨日补传详情】
${details.crossDayUploads.map(e => 
  `  行${e.lineNumber} [${e.filename}]: 券号${e.couponNo}, 核销${e.verificationDate}, 上传${e.uploadDate}, 相差${e.daysDiff}天`
).join('\n')}
`;
    }

    if (details.levelChanges.length > 0) {
      text += `
【等级变更详情】
${details.levelChanges.map(e => 
  `  行${e.lineNumber} [${e.filename}]: 券号${e.couponNo}, 从${e.previousLevel}变更为${e.currentLevel}`
).join('\n')}
`;
    }

    if (details.duplicateRuns.length > 0) {
      text += `
【可复跑输出详情】
${details.duplicateRuns.map(e => 
  `  行${e.lineNumber} [${e.filename}]: 券号${e.couponNo}在${e.verificationDate}重复核销, 首次出现于${e.previousFile}行${e.previousLine}`
).join('\n')}
`;
    }

    text += `
=======================================
           报告生成完成
=======================================
`;

    return text;
  }
}

module.exports = MealCouponAuditor;
