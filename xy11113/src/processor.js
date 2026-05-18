const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class SignDataProcessor {
  constructor() {
    this.normalRecords = [];
    this.abnormalRecords = [];
    this.errorLogs = [];
    this.seenRecords = new Map();
  }

  validateRecord(record, filename, lineNumber) {
    const errors = [];
    
    if (!record['老人姓名'] || !record['老人姓名'].trim()) {
      errors.push('缺少老人姓名');
    }
    
    if (!record['测量日期'] || !record['测量日期'].trim()) {
      errors.push('缺少测量日期');
    }
    
    if (!record['测量时间'] || !record['测量时间'].trim()) {
      errors.push('缺少测量时间');
    }
    
    const bloodPressure = record['血压'] || '';
    if (bloodPressure && !/^\d+\/\d+$/.test(bloodPressure.trim())) {
      errors.push('血压格式错误，应为"收缩压/舒张压"格式');
    }
    
    const bloodSugar = record['血糖'] || '';
    const bloodSugarType = record['血糖类型'] || '';
    
    if (bloodSugar) {
      const sugarValue = parseFloat(bloodSugar);
      if (isNaN(sugarValue)) {
        errors.push('血糖值不是有效数字');
      }
      
      if (!bloodSugarType || !['空腹', '餐后'].includes(bloodSugarType.trim())) {
        errors.push('血糖类型必须是"空腹"或"餐后"');
      }
      
      if (bloodSugarType && sugarValue) {
        if (bloodSugarType.trim() === '空腹' && (sugarValue < 3.9 || sugarValue > 7.0)) {
          errors.push('空腹血糖异常（正常范围3.9-7.0mmol/L）');
        } else if (bloodSugarType.trim() === '餐后' && (sugarValue < 7.8 || sugarValue > 11.1)) {
          errors.push('餐后血糖异常（正常范围7.8-11.1mmol/L）');
        }
      }
    }
    
    const heartRate = record['心率'] || '';
    if (heartRate) {
      const rate = parseInt(heartRate);
      if (isNaN(rate)) {
        errors.push('心率不是有效数字');
      } else if (rate < 60 || rate > 100) {
        errors.push('心率异常（正常范围60-100次/分钟）');
      }
    }
    
    const temperature = record['体温'] || '';
    if (temperature) {
      const temp = parseFloat(temperature);
      if (isNaN(temp)) {
        errors.push('体温不是有效数字');
      } else if (temp < 36.0 || temp > 37.5) {
        errors.push('体温异常（正常范围36.0-37.5℃）');
      }
    }
    
    const recordKey = `${record['老人姓名']}-${record['测量日期']}-${record['测量时间']}-${bloodSugarType}`;
    if (this.seenRecords.has(recordKey)) {
      errors.push('重复测量记录');
    }
    this.seenRecords.set(recordKey, true);
    
    return errors;
  }

  processRecord(record, filename, lineNumber) {
    const errors = this.validateRecord(record, filename, lineNumber);
    
    const enrichedRecord = {
      ...record,
      '来源文件': filename,
      '行号': lineNumber
    };
    
    if (errors.length === 0) {
      this.normalRecords.push(enrichedRecord);
    } else {
      this.abnormalRecords.push({
        ...enrichedRecord,
        '异常原因': errors.join('; ')
      });
      this.errorLogs.push({
        filename,
        lineNumber,
        record: record['老人姓名'] || '未知',
        errors
      });
    }
  }

  async processFile(filePath) {
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
          records.push({ data, line: lineNumber });
          lineNumber++;
        })
        .on('end', () => {
          records.forEach(({ data, line }) => {
            try {
              this.processRecord(data, filename, line);
            } catch (error) {
              this.errorLogs.push({
                filename,
                lineNumber: line,
                record: data['老人姓名'] || '未知',
                errors: [`处理错误: ${error.message}`]
              });
            }
          });
          resolve();
        })
        .on('error', (error) => {
          this.errorLogs.push({
            filename,
            lineNumber: 0,
            record: '文件读取',
            errors: [`文件错误: ${error.message}`]
          });
          reject(error);
        });
    });
  }

  async processDirectory(inputDir) {
    const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.csv'));
    
    for (const file of files) {
      const filePath = path.join(inputDir, file);
      try {
        await this.processFile(filePath);
      } catch (error) {
        console.error(`处理文件 ${file} 时出错，继续处理下一个文件:`, error.message);
      }
    }
  }

  async writeResults(outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    if (this.normalRecords.length > 0) {
      const normalHeaders = Object.keys(this.normalRecords[0]).map(key => ({
        id: key,
        title: key
      }));
      
      const normalWriter = createCsvWriter({
        path: path.join(outputDir, '正常记录.csv'),
        header: normalHeaders
      });
      await normalWriter.writeRecords(this.normalRecords);
    }
    
    if (this.abnormalRecords.length > 0) {
      const abnormalHeaders = Object.keys(this.abnormalRecords[0]).map(key => ({
        id: key,
        title: key
      }));
      
      const abnormalWriter = createCsvWriter({
        path: path.join(outputDir, '异常记录.csv'),
        header: abnormalHeaders
      });
      await abnormalWriter.writeRecords(this.abnormalRecords);
    }
    
    await this.writeSummary(outputDir);
  }

  async writeSummary(outputDir) {
    const summary = {
      处理时间: new Date().toLocaleString('zh-CN'),
      总记录数: this.normalRecords.length + this.abnormalRecords.length,
      正常记录数: this.normalRecords.length,
      异常记录数: this.abnormalRecords.length,
      异常详情: this.errorLogs.map(log => ({
        文件: log.filename,
        行号: log.lineNumber,
        老人: log.record,
        异常原因: log.errors.join('; ')
      }))
    };
    
    fs.writeFileSync(
      path.join(outputDir, '处理摘要.json'),
      JSON.stringify(summary, null, 2),
      'utf8'
    );
    
    const summaryText = this.generateTextSummary(summary);
    fs.writeFileSync(
      path.join(outputDir, '处理摘要.txt'),
      summaryText,
      'utf8'
    );
  }

  generateTextSummary(summary) {
    let text = `========================================
养老日托站养老体征日报 - 数据处理摘要
========================================

处理时间: ${summary.处理时间}

统计信息:
- 总记录数: ${summary.总记录数}
- 正常记录数: ${summary.正常记录数}
- 异常记录数: ${summary.异常记录数}

异常记录详情:
`;

    summary.异常详情.forEach((item, index) => {
      text += `
${index + 1}. 文件: ${item.文件}
   行号: ${item.行号}
   老人: ${item.老人}
   原因: ${item.异常原因}
`;
    });

    text += `
========================================
运营同事修复数据指南:
1. 打开对应来源文件
2. 跳转到指定行号
3. 根据异常原因修改数据
4. 重新运行本程序
========================================
`;

    return text;
  }

  getStats() {
    return {
      total: this.normalRecords.length + this.abnormalRecords.length,
      normal: this.normalRecords.length,
      abnormal: this.abnormalRecords.length
    };
  }
}

module.exports = SignDataProcessor;
