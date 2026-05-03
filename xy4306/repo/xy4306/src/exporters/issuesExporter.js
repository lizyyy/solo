const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { createObjectCsvWriter } = require('fast-csv');
const { ISSUE_TYPES, ISSUE_SEVERITY, ISSUE_DESCRIPTIONS, CONFIG } = require('../config/constants');

class IssuesExporter {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.issuesDir = path.join(outputDir, CONFIG.OUTPUT.ISSUES_FOLDER);
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.issuesDir)) {
      fs.mkdirSync(this.issuesDir, { recursive: true });
    }
  }

  exportConsolidatedIssues(consolidatedReport) {
    const { allIssues } = consolidatedReport;
    
    const filename = 'issues_all.csv';
    const filepath = path.join(this.issuesDir, filename);
    
    const rows = allIssues.map(issue => this.formatIssueRow(issue, true));
    
    return this.writeCsv(filepath, rows, this.getHeader());
  }

  exportBatchIssues(analysisResult) {
    const { vehicle, batch, issues } = analysisResult;
    
    const filename = `issues_${vehicle}_${batch}.csv`;
    const filepath = path.join(this.issuesDir, filename);
    
    const rows = issues.map(issue => this.formatIssueRow(issue, false, vehicle, batch));
    
    return this.writeCsv(filepath, rows, this.getHeader(false));
  }

  getHeader(includeVehicleBatch = true) {
    const header = [
      '问题ID',
      '问题类型',
      '问题类型描述',
      '严重程度',
      '开始时间',
      '结束时间',
      '持续时间(分钟)',
      '持续时间(格式化)',
      '最高温度',
      '平均温度',
      '是否与开门相关',
      '是否可解释',
      '描述'
    ];

    if (includeVehicleBatch) {
      header.unshift('车辆', '批次');
    }

    return header;
  }

  formatIssueRow(issue, includeVehicleBatch = true, defaultVehicle = '', defaultBatch = '') {
    const severityText = {
      critical: '严重',
      high: '高',
      medium: '中',
      low: '低'
    };

    const row = {
      '问题ID': issue.id,
      '问题类型': issue.type,
      '问题类型描述': ISSUE_DESCRIPTIONS[issue.type] || issue.type,
      '严重程度': severityText[issue.severity] || issue.severity,
      '开始时间': issue.startTimeStr || issue.timeStr || '',
      '结束时间': issue.endTimeStr || issue.startTimeStr || '',
      '持续时间(分钟)': issue.durationMinutes?.toFixed(2) || '',
      '持续时间(格式化)': issue.durationFormatted || '',
      '最高温度': issue.maxTemperature?.toFixed(2) || '',
      '平均温度': issue.avgTemperature?.toFixed(2) || '',
      '是否与开门相关': issue.isDoorRelated ? '是' : '否',
      '是否可解释': issue.isExplainable ? '是' : '否',
      '描述': issue.description || ''
    };

    if (includeVehicleBatch) {
      row['车辆'] = issue.vehicle || defaultVehicle;
      row['批次'] = issue.batch || defaultBatch;
    }

    return row;
  }

  async writeCsv(filepath, rows, header) {
    return new Promise((resolve, reject) => {
      if (rows.length === 0) {
        const headerLine = header.join(',') + '\n';
        fs.writeFileSync(filepath, headerLine, 'utf-8');
        resolve({
          filename: path.basename(filepath),
          filepath,
          count: 0
        });
        return;
      }

      const writeStream = fs.createWriteStream(filepath);
      const csvWriter = createObjectCsvWriter({
        headers: header,
        includeEndRowDelimiter: true
      });

      csvWriter.pipe(writeStream);

      rows.forEach(row => csvWriter.write(row));
      csvWriter.end();

      writeStream.on('finish', () => {
        resolve({
          filename: path.basename(filepath),
          filepath,
          count: rows.length
        });
      });

      writeStream.on('error', (error) => {
        reject(error);
      });
    });
  }

  exportBySeverity(consolidatedReport) {
    const { allIssues } = consolidatedReport;
    
    const files = [];
    
    for (const severity of [ISSUE_SEVERITY.CRITICAL, ISSUE_SEVERITY.HIGH, ISSUE_SEVERITY.MEDIUM, ISSUE_SEVERITY.LOW]) {
      const severityIssues = allIssues.filter(i => i.severity === severity);
      
      if (severityIssues.length > 0) {
        const filename = `issues_${severity}.csv`;
        const filepath = path.join(this.issuesDir, filename);
        const rows = severityIssues.map(issue => this.formatIssueRow(issue, true));
        
        const result = await this.writeCsv(filepath, rows, this.getHeader());
        files.push(result);
      }
    }
    
    return files;
  }

  exportByType(consolidatedReport) {
    const { allIssues } = consolidatedReport;
    
    const files = [];
    const typeGroups = {};
    
    for (const issue of allIssues) {
      if (!typeGroups[issue.type]) {
        typeGroups[issue.type] = [];
      }
      typeGroups[issue.type].push(issue);
    }
    
    for (const [type, issues] of Object.entries(typeGroups)) {
      const filename = `issues_${type}.csv`;
      const filepath = path.join(this.issuesDir, filename);
      const rows = issues.map(issue => this.formatIssueRow(issue, true));
      
      const result = await this.writeCsv(filepath, rows, this.getHeader());
      files.push(result);
    }
    
    return files;
  }
}

module.exports = IssuesExporter;
