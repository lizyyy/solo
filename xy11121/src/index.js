const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class SigninCleaner {
  constructor(options) {
    this.inputDir = options.inputDir;
    this.rulesFile = options.rulesFile;
    this.outputDir = options.outputDir;
    this.preview = options.preview;
    
    this.rules = null;
    this.rawRecords = [];
    this.cleanedRecords = [];
    this.issues = {
      duplicatePhone: [],
      scanDelay: [],
      missingFields: [],
      invalidFormat: []
    };
    this.sourceTracking = [];
  }

  async run() {
    console.log('=== 图书馆活动组活动签到数据清洗 ===\n');
    
    await this.loadRules();
    await this.readInputFiles();
    await this.detectIssues();
    await this.cleanData();
    await this.generateReport();
    await this.writeOutput();
    
    this.printSummary();
  }

  async loadRules() {
    console.log('📋 加载清洗规则...');
    const content = fs.readFileSync(this.rulesFile, 'utf-8');
    this.rules = JSON.parse(content);
    console.log(`   规则文件: ${path.basename(this.rulesFile)}`);
    console.log(`   允许扫码延迟: ${this.rules.scanDelayThreshold} 分钟`);
    console.log(`   必填字段: ${this.rules.requiredFields.join(', ')}\n`);
  }

  async readInputFiles() {
    console.log('📂 读取输入文件...');
    
    const files = fs.readdirSync(this.inputDir);
    const dataFiles = files.filter(f => 
      f.endsWith('.csv') || f.endsWith('.xlsx') || f.endsWith('.xls')
    );
    
    if (dataFiles.length === 0) {
      throw new Error('输入目录中未找到CSV或Excel文件');
    }
    
    for (const file of dataFiles) {
      const filePath = path.join(this.inputDir, file);
      console.log(`   读取: ${file}`);
      
      if (file.endsWith('.csv')) {
        await this.readCSV(filePath, file);
      } else {
        await this.readExcel(filePath, file);
      }
    }
    
    console.log(`   共读取 ${this.rawRecords.length} 条原始记录\n`);
  }

  async readCSV(filePath, fileName) {
    return new Promise((resolve) => {
      let lineNumber = 1;
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', () => {
          lineNumber = 2;
        })
        .on('data', (row) => {
          this.rawRecords.push({
            ...row,
            _source: {
              file: fileName,
              line: lineNumber
            }
          });
          lineNumber++;
        })
        .on('end', resolve);
    });
  }

  async readExcel(filePath, fileName) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    
    data.forEach((row, index) => {
      this.rawRecords.push({
        ...row,
        _source: {
          file: fileName,
          line: index + 2
        }
      });
    });
  }

  async detectIssues() {
    console.log('🔍 检测数据问题...');
    
    const phoneMap = new Map();
    
    for (const record of this.rawRecords) {
      this.sourceTracking.push({
        id: this.generateRecordId(record),
        source: record._source,
        originalData: { ...record }
      });
      
      this.checkMissingFields(record);
      this.checkPhoneFormat(record);
      
      const phone = this.normalizePhone(record.手机号 || record.phone || '');
      if (phone) {
        if (!phoneMap.has(phone)) {
          phoneMap.set(phone, []);
        }
        phoneMap.get(phone).push(record);
      }
      
      this.checkScanDelay(record);
    }
    
    for (const [phone, records] of phoneMap.entries()) {
      if (records.length > 1) {
        this.issues.duplicatePhone.push({
          phone,
          records: records.map(r => ({
            name: r.姓名 || r.name || '未知',
            activity: r.活动名称 || r.activity || '未知',
            source: r._source
          }))
        });
      }
    }
    
    console.log(`   同手机号多人: ${this.issues.duplicatePhone.length} 组`);
    console.log(`   扫码延迟: ${this.issues.scanDelay.length} 条`);
    console.log(`   缺失字段: ${this.issues.missingFields.length} 条`);
    console.log(`   格式错误: ${this.issues.invalidFormat.length} 条\n`);
  }

  checkMissingFields(record) {
    const missing = [];
    for (const field of this.rules.requiredFields) {
      if (!record[field] && !record[this.getFieldAlias(field)]) {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      this.issues.missingFields.push({
        record,
        missingFields: missing,
        source: record._source
      });
    }
  }

  checkPhoneFormat(record) {
    const phone = this.normalizePhone(record.手机号 || record.phone || '');
    if (phone && phone.length !== 11) {
      this.issues.invalidFormat.push({
        type: '手机号格式错误',
        value: phone,
        record,
        source: record._source
      });
    }
  }

  checkScanDelay(record) {
    const signTime = record.签到时间 || record.signTime || record.time;
    const activityTime = record.活动开始时间 || record.activityTime;
    
    if (signTime && activityTime) {
      try {
        const signDate = new Date(signTime);
        const activityDate = new Date(activityTime);
        const diffMinutes = (signDate - activityDate) / (1000 * 60);
        
        if (diffMinutes > this.rules.scanDelayThreshold) {
          this.issues.scanDelay.push({
            name: record.姓名 || record.name || '未知',
            activity: record.活动名称 || record.activity || '未知',
            signTime: signTime,
            activityTime: activityTime,
            delayMinutes: Math.round(diffMinutes),
            source: record._source
          });
        }
      } catch (e) {
      }
    }
  }

  getFieldAlias(field) {
    const aliases = {
      '姓名': ['name', '姓名'],
      '手机号': ['phone', '手机号', '手机号码'],
      '活动名称': ['activity', '活动名称', '活动'],
      '签到时间': ['signTime', '签到时间', '时间']
    };
    return aliases[field] ? aliases[field][0] : field;
  }

  normalizePhone(phone) {
    if (!phone) return '';
    return String(phone).replace(/\D/g, '');
  }

  generateRecordId(record) {
    const phone = this.normalizePhone(record.手机号 || record.phone || '');
    const name = record.姓名 || record.name || '';
    const time = record.签到时间 || record.time || '';
    return Buffer.from(`${name}-${phone}-${time}`).toString('base64').substring(0, 12);
  }

  async cleanData() {
    console.log('🧹 清洗数据...');
    
    const seen = new Set();
    
    for (const record of this.rawRecords) {
      const phone = this.normalizePhone(record.手机号 || record.phone || '');
      const name = record.姓名 || record.name || '';
      const activity = record.活动名称 || record.activity || '';
      
      const key = `${phone}-${name}-${activity}`;
      
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      
      const cleaned = {
        序号: this.cleanedRecords.length + 1,
        姓名: name,
        手机号: phone,
        活动名称: activity,
        签到时间: record.签到时间 || record.signTime || '',
        签到状态: this.getSigninStatus(record),
        记录ID: this.generateRecordId(record),
        源文件: record._source.file,
        源行号: record._source.line
      };
      
      this.cleanedRecords.push(cleaned);
    }
    
    console.log(`   清洗后保留 ${this.cleanedRecords.length} 条有效记录\n`);
  }

  getSigninStatus(record) {
    const signTime = record.签到时间 || record.signTime;
    const activityTime = record.活动开始时间 || record.activityTime;
    
    if (!signTime) return '待确认';
    
    if (activityTime) {
      try {
        const diff = (new Date(signTime) - new Date(activityTime)) / (1000 * 60);
        if (diff > this.rules.scanDelayThreshold) {
          return '延迟签到';
        }
      } catch (e) {}
    }
    
    return '正常签到';
  }

  async generateReport() {
    console.log('📝 生成清洗报告...');
    
    let report = '# 图书馆活动组活动签到数据清洗报告\n\n';
    report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    
    report += '## 一、处理概览\n\n';
    report += `- 原始记录数: ${this.rawRecords.length}\n`;
    report += `- 清洗后记录数: ${this.cleanedRecords.length}\n`;
    report += `- 去重删除数: ${this.rawRecords.length - this.cleanedRecords.length}\n\n`;
    
    report += '## 二、同手机号多人问题\n\n';
    if (this.issues.duplicatePhone.length === 0) {
      report += '无同手机号多人问题\n\n';
    } else {
      for (const issue of this.issues.duplicatePhone) {
        report += `### 手机号: ${issue.phone}\n\n`;
        report += '| 姓名 | 活动名称 | 源文件 | 源行号 |\n';
        report += '|------|----------|--------|--------|\n';
        for (const r of issue.records) {
          report += `| ${r.name} | ${r.activity} | ${r.source.file} | ${r.source.line} |\n`;
        }
        report += '\n';
      }
    }
    
    report += '## 三、扫码延迟问题\n\n';
    if (this.issues.scanDelay.length === 0) {
      report += '无扫码延迟问题\n\n';
    } else {
      report += '| 姓名 | 活动名称 | 签到时间 | 活动开始时间 | 延迟(分钟) | 源文件 | 源行号 |\n';
      report += '|------|----------|----------|--------------|------------|--------|--------|\n';
      for (const issue of this.issues.scanDelay) {
        report += `| ${issue.name} | ${issue.activity} | ${issue.signTime} | ${issue.activityTime} | ${issue.delayMinutes} | ${issue.source.file} | ${issue.source.line} |\n`;
      }
      report += '\n';
    }
    
    report += '## 四、缺失字段问题\n\n';
    if (this.issues.missingFields.length === 0) {
      report += '无缺失字段问题\n\n';
    } else {
      report += '| 姓名 | 缺失字段 | 源文件 | 源行号 |\n';
      report += '|------|----------|--------|--------|\n';
      for (const issue of this.issues.missingFields) {
        const name = issue.record.姓名 || issue.record.name || '未知';
        report += `| ${name} | ${issue.missingFields.join(', ')} | ${issue.source.file} | ${issue.source.line} |\n`;
      }
      report += '\n';
    }
    
    report += '## 五、可复跑追踪信息\n\n';
    report += '| 记录ID | 姓名 | 手机号 | 源文件 | 源行号 |\n';
    report += '|--------|------|--------|--------|--------|\n';
    for (const track of this.sourceTracking.slice(0, 50)) {
      const name = track.originalData.姓名 || track.originalData.name || '未知';
      const phone = this.normalizePhone(track.originalData.手机号 || track.originalData.phone || '');
      report += `| ${track.id} | ${name} | ${phone} | ${track.source.file} | ${track.source.line} |\n`;
    }
    if (this.sourceTracking.length > 50) {
      report += `\n... 还有 ${this.sourceTracking.length - 50} 条记录，请查看输出文件\n`;
    }
    
    if (!this.preview) {
      fs.writeFileSync(path.join(this.outputDir, 'report.md'), report, 'utf-8');
      console.log(`   报告已生成: ${path.join(this.outputDir, 'report.md')}`);
    }
  }

  async writeOutput() {
    if (this.preview) {
      console.log('\n📊 预览清洗结果前10条:\n');
      console.log('| 序号 | 姓名 | 手机号 | 活动名称 | 签到状态 | 源文件 | 源行号 |');
      console.log('|------|------|--------|----------|----------|--------|--------|');
      for (const r of this.cleanedRecords.slice(0, 10)) {
        console.log(`| ${r.序号} | ${r.姓名} | ${r.手机号} | ${r.活动名称} | ${r.签到状态} | ${r.源文件} | ${r.源行号} |`);
      }
      return;
    }
    
    console.log('💾 写入输出文件...');
    
    const csvWriter = createCsvWriter({
      path: path.join(this.outputDir, 'cleaned_signin.csv'),
      header: [
        { id: '序号', title: '序号' },
        { id: '姓名', title: '姓名' },
        { id: '手机号', title: '手机号' },
        { id: '活动名称', title: '活动名称' },
        { id: '签到时间', title: '签到时间' },
        { id: '签到状态', title: '签到状态' },
        { id: '记录ID', title: '记录ID' },
        { id: '源文件', title: '源文件' },
        { id: '源行号', title: '源行号' }
      ]
    });
    
    await csvWriter.writeRecords(this.cleanedRecords);
    console.log(`   清洗数据已写入: ${path.join(this.outputDir, 'cleaned_signin.csv')}`);
    
    const trackingWriter = createCsvWriter({
      path: path.join(this.outputDir, 'source_tracking.csv'),
      header: [
        { id: '记录ID', title: '记录ID' },
        { id: '姓名', title: '姓名' },
        { id: '手机号', title: '手机号' },
        { id: '源文件', title: '源文件' },
        { id: '源行号', title: '源行号' }
      ]
    });
    
    const trackingData = this.sourceTracking.map(t => ({
      记录ID: t.id,
      姓名: t.originalData.姓名 || t.originalData.name || '未知',
      手机号: this.normalizePhone(t.originalData.手机号 || t.originalData.phone || ''),
      源文件: t.source.file,
      源行号: t.source.line
    }));
    
    await trackingWriter.writeRecords(trackingData);
    console.log(`   追踪数据已写入: ${path.join(this.outputDir, 'source_tracking.csv')}\n`);
  }

  printSummary() {
    console.log('=== 处理总结 ===');
    console.log(`原始记录: ${this.rawRecords.length} 条`);
    console.log(`清洗后: ${this.cleanedRecords.length} 条`);
    console.log(`同手机号多人: ${this.issues.duplicatePhone.length} 组`);
    console.log(`扫码延迟: ${this.issues.scanDelay.length} 条`);
  }
}

module.exports = SigninCleaner;
