const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const config = require('../config');

class WalkthroughValidator {
  constructor() {
    this.maxTime = config.validators.maxWalkthroughTime;
    this.timeColumns = ['时间', 'time', '时长', 'duration', '开始时间', '结束时间'];
    this.walkthroughFilePatterns = [
      /走台/i,
      /提示/i,
      /walkthrough/i,
      /流程/i,
      /timeline/i,
      /schedule/i
    ];
    this.nonWalkthroughPatterns = [
      /名单/i,
      /人员/i,
      /member/i,
      /roster/i,
      /名单/i,
      /联系/i,
      /contact/i
    ];
  }
  
  isLikelyWalkthroughFile(filename) {
    const lowerName = filename.toLowerCase();
    
    for (const pattern of this.nonWalkthroughPatterns) {
      if (pattern.test(lowerName)) {
        return false;
      }
    }
    
    for (const pattern of this.walkthroughFilePatterns) {
      if (pattern.test(lowerName)) {
        return true;
      }
    }
    
    return 'maybe';
  }
  
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const stream = fs.createReadStream(filePath)
        .pipe(csv());
      
      stream.on('data', (data) => results.push(data));
      stream.on('end', () => resolve(results));
      stream.on('error', (error) => reject(error));
    });
  }
  
  parseTime(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
      return null;
    }
    
    const trimmed = timeStr.trim();
    
    const hmsMatch = trimmed.match(/^(\d+):(\d+):(\d+)$/);
    if (hmsMatch) {
      const hours = parseInt(hmsMatch[1], 10);
      const minutes = parseInt(hmsMatch[2], 10);
      const seconds = parseInt(hmsMatch[3], 10);
      return hours * 3600 + minutes * 60 + seconds;
    }
    
    const msMatch = trimmed.match(/^(\d+):(\d+)$/);
    if (msMatch) {
      const minutes = parseInt(msMatch[1], 10);
      const seconds = parseInt(msMatch[2], 10);
      return minutes * 60 + seconds;
    }
    
    const numMatch = trimmed.match(/^(\d+(\.\d+)?)$/);
    if (numMatch) {
      return parseFloat(numMatch[1]);
    }
    
    return null;
  }
  
  formatTime(seconds) {
    if (seconds >= 3600) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
  }
  
  findTimeColumn(headers) {
    for (const header of headers) {
      const lowerHeader = header.toLowerCase().trim();
      for (const col of this.timeColumns) {
        if (lowerHeader.includes(col.toLowerCase())) {
          return header;
        }
      }
    }
    return null;
  }
  
  async validateCSVFile(filePath) {
    const risks = [];
    const fileInfo = {
      path: filePath,
      name: path.basename(filePath),
      totalRows: 0,
      timeValues: [],
      invalidRows: [],
      outOfBoundsRows: []
    };
    
    try {
      const rows = await this.parseCSV(filePath);
      fileInfo.totalRows = rows.length;
      
      if (rows.length === 0) {
        risks.push({
          type: 'walkthrough',
          severity: 'warning',
          category: '内容',
          message: '走台提示CSV文件为空',
          file_path: filePath,
          details: { rowCount: 0 }
        });
        return { valid: true, risks, fileInfo };
      }
      
      const headers = Object.keys(rows[0]);
      const timeColumn = this.findTimeColumn(headers);
      
      if (!timeColumn) {
        const isMaybe = this.isLikelyWalkthroughFile(fileInfo.name) === 'maybe';
        const severity = isMaybe ? 'info' : 'warning';
        const message = isMaybe 
          ? '该CSV文件不包含时间列，非走台提示文件，跳过校验'
          : '未在CSV中找到时间列，跳过时间越界校验';
        
        risks.push({
          type: 'walkthrough',
          severity,
          category: '格式',
          message,
          file_path: filePath,
          details: {
            availableColumns: headers,
            expectedColumns: this.timeColumns,
            fileType: this.isLikelyWalkthroughFile(fileInfo.name)
          }
        });
        return { valid: true, risks, fileInfo };
      }
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        const timeValue = row[timeColumn];
        
        if (!timeValue || timeValue.toString().trim() === '') {
          continue;
        }
        
        const seconds = this.parseTime(timeValue);
        
        if (seconds === null) {
          fileInfo.invalidRows.push({
            row: rowNum,
            value: timeValue,
            column: timeColumn
          });
          continue;
        }
        
        fileInfo.timeValues.push({
          row: rowNum,
          value: timeValue,
          seconds,
          formatted: this.formatTime(seconds)
        });
        
        if (seconds > this.maxTime) {
          fileInfo.outOfBoundsRows.push({
            row: rowNum,
            value: timeValue,
            seconds,
            formatted: this.formatTime(seconds),
            maxAllowed: this.formatTime(this.maxTime)
          });
        }
      }
      
      if (fileInfo.invalidRows.length > 0) {
        risks.push({
          type: 'walkthrough',
          severity: 'warning',
          category: '格式',
          message: `发现 ${fileInfo.invalidRows.length} 行时间格式无法解析`,
          file_path: filePath,
          details: {
            column: timeColumn,
            invalidRows: fileInfo.invalidRows.slice(0, 10).map(r => ({
              row: r.row,
              value: r.value
            })),
            totalInvalid: fileInfo.invalidRows.length,
            tip: '支持格式: HH:MM:SS, MM:SS, 秒数'
          }
        });
      }
      
      if (fileInfo.outOfBoundsRows.length > 0) {
        risks.push({
          type: 'walkthrough',
          severity: 'critical',
          category: '越界',
          message: `发现 ${fileInfo.outOfBoundsRows.length} 个时间值超过最大值 ${this.formatTime(this.maxTime)}`,
          file_path: filePath,
          details: {
            column: timeColumn,
            maxAllowed: this.formatTime(this.maxTime),
            outOfBoundsRows: fileInfo.outOfBoundsRows.map(r => ({
              row: r.row,
              value: r.value,
              formatted: r.formatted
            }))
          }
        });
      }
      
    } catch (error) {
      risks.push({
        type: 'walkthrough',
        severity: 'error',
        category: '解析',
        message: `解析CSV文件失败: ${error.message}`,
        file_path: filePath,
        details: { error: error.message }
      });
    }
    
    const valid = risks.filter(r => r.severity === 'critical').length === 0;
    
    return {
      valid,
      risks,
      fileInfo
    };
  }
  
  async validate(files) {
    const allRisks = [];
    const csvFiles = files.filter(f => 
      path.extname(f.name).toLowerCase() === '.csv'
    );
    
    if (csvFiles.length === 0) {
      return {
        valid: true,
        risks: [{
          type: 'walkthrough',
          severity: 'warning',
          category: '完整性',
          message: '未找到走台提示CSV文件',
          details: {}
        }],
        csvResults: []
      };
    }
    
    const definiteWalkthroughFiles = csvFiles.filter(f => 
      this.isLikelyWalkthroughFile(f.name) === true
    );
    
    const maybeWalkthroughFiles = csvFiles.filter(f => 
      this.isLikelyWalkthroughFile(f.name) === 'maybe'
    );
    
    const filesToValidate = definiteWalkthroughFiles.length > 0 
      ? definiteWalkthroughFiles 
      : maybeWalkthroughFiles;
    
    if (filesToValidate.length === 0) {
      return {
        valid: true,
        risks: [{
          type: 'walkthrough',
          severity: 'info',
          category: '信息',
          message: '未找到走台提示CSV文件（检测到人员名单等其他CSV文件已跳过',
          details: {
            skippedFiles: csvFiles.filter(f => 
              this.isLikelyWalkthroughFile(f.name) === false
            ).map(f => f.name)
          }
        }],
        csvResults: []
      };
    }
    
    const csvResults = [];
    for (const csvFile of filesToValidate) {
      const result = await this.validateCSVFile(csvFile.path);
      csvResults.push({
        file: csvFile.name,
        path: csvFile.path,
        ...result
      });
      allRisks.push(...result.risks);
    }
    
    const valid = allRisks.filter(r => r.severity === 'critical').length === 0;
    
    return {
      valid,
      risks: allRisks,
      csvResults
    };
  }
}

module.exports = WalkthroughValidator;
