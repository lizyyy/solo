const fs = require('fs');
const path = require('path');

class GreenhouseReporter {
  constructor(parseResult, validationResult, outputDir = './output') {
    this.parseResult = parseResult;
    this.validationResult = validationResult;
    this.outputDir = outputDir;
    this.generatedFiles = [];
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  generate() {
    const summaryReport = this.generateSummaryReport();
    const missingDataReport = this.generateMissingDataReport();
    const sensorChangeReport = this.generateSensorChangeReport();
    const reproducibleData = this.generateReproducibleData();
    const fileListReport = this.generateFileListReport();
    
    return {
      summaryReport,
      missingDataReport,
      sensorChangeReport,
      reproducibleData,
      fileListReport,
      generatedFiles: this.generatedFiles
    };
  }

  generateSummaryReport() {
    const filePath = path.join(this.outputDir, 'SUMMARY.md');
    const stats = this.validationResult.stats;
    
    let content = '# 花卉温室环境汇总 - 总览报告\n\n';
    content += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    
    content += '## 📊 数据统计\n\n';
    content += `- 总记录数: ${stats.totalRecords}\n`;
    content += `- 覆盖区域: ${stats.zones.join(', ')}\n`;
    content += `- 问题总数: ${stats.issueCount}\n`;
    content += `  - 缺测数据: ${stats.missingCount} 条\n`;
    content += `  - 警告: ${stats.warningCount} 个\n`;
    content += `  - 错误: ${stats.errorCount} 个\n\n`;
    
    content += '## 🌡️  各区域环境参数统计\n\n';
    
    Object.keys(stats.statsByZone).forEach(zone => {
      const zoneStats = stats.statsByZone[zone];
      content += `### ${zone}\n\n`;
      content += `| 参数 | 有效数据 | 最小值 | 最大值 | 平均值 |\n`;
      content += `|------|----------|--------|--------|--------|\n`;
      
      const fields = {
        temperature: '温度(°C)',
        humidity: '湿度(%)',
        co2: 'CO2(ppm)',
        light: '光照(lux)',
        soilMoisture: '土壤湿度(%)'
      };
      
      Object.keys(fields).forEach(field => {
        const fs = zoneStats[field];
        if (fs && !fs.missing) {
          content += `| ${fields[field]} | ${fs.validCount} | ${fs.min} | ${fs.max} | ${fs.avg} |\n`;
        }
      });
      content += '\n';
    });
    
    content += '## 📁 生成文件清单\n\n';
    content += '查看 [FILES.md](./FILES.md) 获取详细文件说明。\n';
    
    fs.writeFileSync(filePath, content, 'utf-8');
    this.generatedFiles.push({
      name: 'SUMMARY.md',
      path: filePath,
      description: '总览报告 - 包含数据统计和各区域环境参数汇总'
    });
    
    return filePath;
  }

  generateMissingDataReport() {
    const filePath = path.join(this.outputDir, 'MISSING-DATA.md');
    const missingIssues = this.validationResult.issues.filter(i => i.level === 'MISSING');
    
    let content = '# 花卉温室环境汇总 - 缺测数据报告\n\n';
    content += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    content += `共发现 **${missingIssues.length}** 条缺测数据\n\n`;
    
    if (missingIssues.length > 0) {
      content += '## 缺测详情\n\n';
      content += '| 序号 | 缺测字段 | 源文件 | 行号 |\n';
      content += '|------|----------|--------|------|\n';
      
      missingIssues.forEach((issue, index) => {
        const fieldName = issue.message.replace('数据缺测', '');
        content += `| ${index + 1} | ${fieldName} | ${issue.sourceFile} | ${issue.lineNumber} |\n`;
      });
      content += '\n';
      
      content += '## 处理建议\n\n';
      content += '1. 检查对应传感器是否正常工作\n';
      content += '2. 检查数据采集程序是否有中断\n';
      content += '3. 对于重要的缺测数据，可以使用前后数据插值补全\n';
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
    this.generatedFiles.push({
      name: 'MISSING-DATA.md',
      path: filePath,
      description: '缺测数据报告 - 详细列出所有缺测字段及其源文件位置'
    });
    
    return filePath;
  }

  generateSensorChangeReport() {
    const filePath = path.join(this.outputDir, 'SENSOR-CHANGES.md');
    const changes = this.validationResult.sensorChanges;
    
    let content = '# 花卉温室环境汇总 - 传感器更换报告\n\n';
    content += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    content += `共检测到 **${changes.length}** 次传感器更换\n\n`;
    
    if (changes.length > 0) {
      content += '## 更换详情\n\n';
      content += '| 序号 | 区域 | 原传感器 | 新传感器 | 更换时间 | 源文件 | 行号 |\n';
      content += '|------|------|----------|----------|----------|--------|------|\n';
      
      changes.forEach((change, index) => {
        const time = change.timestamp ? new Date(change.timestamp).toLocaleString('zh-CN') : '未知';
        content += `| ${index + 1} | ${change.zone} | ${change.oldSensor} | ${change.newSensor} | ${time} | ${change.sourceFile} | ${change.lineNumber} |\n`;
      });
      content += '\n';
      
      content += '## 注意事项\n\n';
      content += '1. 传感器更换后需要重新校准数据\n';
      content += '2. 不同传感器可能存在系统误差，分析时需注意\n';
      content += '3. 建议保留传感器更换记录用于后续追溯\n';
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
    this.generatedFiles.push({
      name: 'SENSOR-CHANGES.md',
      path: filePath,
      description: '传感器更换报告 - 记录所有传感器更换事件和位置'
    });
    
    return filePath;
  }

  generateReproducibleData() {
    const filePath = path.join(this.outputDir, 'cleaned-data.csv');
    
    const headers = ['timestamp', 'zone', 'sensorId', 'temperature', 'humidity', 'co2', 'light', 'soilMoisture', '_source_file', '_source_line'];
    const chineseHeaders = ['时间', '区域', '传感器编号', '温度(°C)', '湿度(%)', 'CO2(ppm)', '光照(lux)', '土壤湿度(%)', '源文件', '源行号'];
    
    let csvContent = chineseHeaders.join(',') + '\n';
    
    this.parseResult.parsedData.forEach(record => {
      const meta = record._meta;
      const row = [
        record.timestamp || '',
        record.zone || '',
        record.sensorId || '',
        record.temperature !== null ? record.temperature : '',
        record.humidity !== null ? record.humidity : '',
        record.co2 !== null ? record.co2 : '',
        record.light !== null ? record.light : '',
        record.soilMoisture !== null ? record.soilMoisture : '',
        meta.sourceFile,
        meta.lineNumber
      ];
      csvContent += row.join(',') + '\n';
    });
    
    fs.writeFileSync(filePath, csvContent, 'utf-8');
    this.generatedFiles.push({
      name: 'cleaned-data.csv',
      path: filePath,
      description: '清洗后的数据文件 - 可复跑的输出，包含源文件和行号追踪'
    });
    
    return filePath;
  }

  generateFileListReport() {
    const filePath = path.join(this.outputDir, 'FILES.md');
    
    let content = '# 花卉温室环境汇总 - 生成文件清单\n\n';
    content += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    content += `本次处理共生成 **${this.generatedFiles.length}** 个文件\n\n`;
    
    content += '## 文件说明\n\n';
    content += '| 文件名 | 用途说明 |\n';
    content += '|--------|----------|\n';
    
    this.generatedFiles.forEach(file => {
      content += `| ${file.name} | ${file.description} |\n`;
    });
    
    content += '\n## 模块说明\n\n';
    content += '### 项目结构\n\n';
    content += '```\n';
    content += 'greenhouse-env-summary-cli/\n';
    content += '├── cli.js              # CLI 主入口\n';
    content += '├── package.json         # 项目配置\n';
    content += '├── src/\n';
    content += '│   ├── parser.js       # 解析模块 - 解析原始数据\n';
    content += '│   ├── validator.js    # 校验模块 - 校验数据完整性和有效性\n';
    content += '│   └── reporter.js     # 报告模块 - 生成各类报告\n';
    content += '├── data/\n';
    content += '│   └── greenhouse-data.csv  # 样例数据\n';
    content += '└── output/             # 输出目录\n';
    content += '    ├── SUMMARY.md      # 总览报告\n';
    content += '    ├── MISSING-DATA.md # 缺测数据报告\n';
    content += '    ├── SENSOR-CHANGES.md # 传感器更换报告\n';
    content += '    ├── cleaned-data.csv # 清洗后的数据\n';
    content += '    └── FILES.md        # 文件清单\n';
    content += '```\n';
    
    fs.writeFileSync(filePath, content, 'utf-8');
    this.generatedFiles.push({
      name: 'FILES.md',
      path: filePath,
      description: '文件清单 - 说明所有生成文件的用途'
    });
    
    return filePath;
  }
}

module.exports = GreenhouseReporter;
