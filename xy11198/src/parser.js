const fs = require('fs');
const path = require('path');

class GreenhouseParser {
  constructor(filePath) {
    this.filePath = filePath;
    this.fileName = path.basename(filePath);
    this.rawData = [];
    this.parsedData = [];
    this.parseLogs = [];
  }

  parse() {
    this.log('INFO', `开始解析文件: ${this.fileName}`);
    
    if (!fs.existsSync(this.filePath)) {
      this.log('ERROR', `文件不存在: ${this.filePath}`);
      throw new Error(`文件不存在: ${this.filePath}`);
    }

    const content = fs.readFileSync(this.filePath, 'utf-8');
    const lines = content.split('\n');
    
    if (lines.length === 0) {
      this.log('ERROR', '文件为空');
      throw new Error('文件为空');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    this.log('INFO', `检测到列头: ${headers.join(', ')}`, 1);

    for (let i = 1; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i].trim();
      
      if (!line) {
        this.log('WARN', `跳过空行`, lineNum);
        continue;
      }

      const values = line.split(',').map(v => v.trim());
      
      if (values.length !== headers.length) {
        this.log('WARN', `列数不匹配，期望 ${headers.length} 列，实际 ${values.length} 列`, lineNum);
      }

      const record = this.parseRecord(headers, values, lineNum);
      this.rawData.push({ record, lineNum, rawLine: line });
      this.parsedData.push(record);
    }

    this.log('INFO', `解析完成，共 ${this.parsedData.length} 条记录`);
    return {
      rawData: this.rawData,
      parsedData: this.parsedData,
      parseLogs: this.parseLogs,
      fileName: this.fileName
    };
  }

  parseRecord(headers, values, lineNum) {
    const record = {};
    
    headers.forEach((header, index) => {
      let value = values[index] || '';
      
      switch (header.toLowerCase()) {
        case 'timestamp':
        case '时间':
          record.timestamp = this.parseTimestamp(value, lineNum);
          break;
        case 'zone':
        case '区域':
          record.zone = value;
          break;
        case 'sensor_id':
        case '传感器编号':
          record.sensorId = value;
          break;
        case 'temperature':
        case '温度':
          record.temperature = this.parseNumber(value, '温度', lineNum);
          break;
        case 'humidity':
        case '湿度':
          record.humidity = this.parseNumber(value, '湿度', lineNum);
          break;
        case 'co2':
        case 'co2浓度':
          record.co2 = this.parseNumber(value, 'CO2浓度', lineNum);
          break;
        case 'light':
        case '光照':
          record.light = this.parseNumber(value, '光照', lineNum);
          break;
        case 'soil_moisture':
        case '土壤湿度':
          record.soilMoisture = this.parseNumber(value, '土壤湿度', lineNum);
          break;
        default:
          record[header] = value;
      }
    });

    record._meta = {
      sourceFile: this.fileName,
      lineNumber: lineNum,
      parsedAt: new Date().toISOString()
    };

    return record;
  }

  parseTimestamp(value, lineNum) {
    if (!value) {
      this.log('MISSING', '时间戳缺失', lineNum);
      return null;
    }
    
    const timestamp = new Date(value);
    if (isNaN(timestamp.getTime())) {
      this.log('WARN', `无效的时间格式: ${value}`, lineNum);
      return value;
    }
    return timestamp.toISOString();
  }

  parseNumber(value, fieldName, lineNum) {
    if (value === '' || value === null || value === undefined) {
      this.log('MISSING', `${fieldName}数据缺失`, lineNum);
      return null;
    }
    
    const num = parseFloat(value);
    if (isNaN(num)) {
      this.log('WARN', `${fieldName}无效数值: ${value}`, lineNum);
      return null;
    }
    return num;
  }

  log(level, message, lineNum = null) {
    const logEntry = {
      level,
      message,
      lineNumber: lineNum,
      sourceFile: this.fileName,
      timestamp: new Date().toISOString()
    };
    this.parseLogs.push(logEntry);
  }
}

module.exports = GreenhouseParser;
