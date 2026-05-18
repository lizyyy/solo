class GreenhouseValidator {
  constructor(parsedData, fileName) {
    this.parsedData = parsedData;
    this.fileName = fileName;
    this.validationResults = [];
    this.issues = [];
    this.sensorChanges = [];
  }

  validate() {
    this.log('INFO', '开始数据校验');
    
    this.checkMissingData();
    this.checkValueRanges();
    this.checkSensorChanges();
    this.checkTimeContinuity();
    
    const stats = this.calculateStats();
    
    this.log('INFO', `校验完成，发现 ${this.issues.length} 个问题`);
    
    return {
      isValid: this.issues.filter(i => i.level === 'ERROR').length === 0,
      issues: this.issues,
      sensorChanges: this.sensorChanges,
      stats,
      validationResults: this.validationResults
    };
  }

  checkMissingData() {
    this.log('INFO', '检查缺失数据...');
    
    const requiredFields = ['timestamp', 'zone', 'sensorId'];
    
    this.parsedData.forEach((record, index) => {
      const meta = record._meta;
      
      requiredFields.forEach(field => {
        if (!record[field]) {
          this.addIssue('ERROR', `必填字段缺失: ${field}`, meta.lineNumber, meta.sourceFile);
        }
      });
      
      const envFields = ['temperature', 'humidity', 'co2', 'light', 'soilMoisture'];
      envFields.forEach(field => {
        if (record[field] === null || record[field] === undefined) {
          this.addIssue('MISSING', `${field}数据缺测`, meta.lineNumber, meta.sourceFile);
        }
      });
    });
  }

  checkValueRanges() {
    this.log('INFO', '检查数值范围...');
    
    const ranges = {
      temperature: { min: -10, max: 50, name: '温度' },
      humidity: { min: 0, max: 100, name: '湿度' },
      co2: { min: 200, max: 5000, name: 'CO2浓度' },
      light: { min: 0, max: 200000, name: '光照' },
      soilMoisture: { min: 0, max: 100, name: '土壤湿度' }
    };
    
    this.parsedData.forEach((record) => {
      const meta = record._meta;
      
      Object.keys(ranges).forEach(field => {
        const value = record[field];
        const range = ranges[field];
        
        if (value !== null && value !== undefined) {
          if (value < range.min || value > range.max) {
            this.addIssue('WARN', `${range.name}数值超出正常范围: ${value} (正常范围 ${range.min}-${range.max})`, meta.lineNumber, meta.sourceFile);
          }
        }
      });
    });
  }

  checkSensorChanges() {
    this.log('INFO', '检查传感器更换记录...');
    
    const zoneSensors = {};
    
    this.parsedData.forEach((record) => {
      const meta = record._meta;
      const zone = record.zone;
      const sensorId = record.sensorId;
      
      if (zone && sensorId) {
        if (!zoneSensors[zone]) {
          zoneSensors[zone] = [];
        }
        
        const lastSensor = zoneSensors[zone][zoneSensors[zone].length - 1];
        
        if (lastSensor && lastSensor !== sensorId) {
          const change = {
            zone,
            oldSensor: lastSensor,
            newSensor: sensorId,
            timestamp: record.timestamp,
            lineNumber: meta.lineNumber,
            sourceFile: meta.sourceFile
          };
          this.sensorChanges.push(change);
          
          this.addIssue('INFO', `传感器更换: 从 ${lastSensor} 更换为 ${sensorId}`, meta.lineNumber, meta.sourceFile);
        }
        
        if (!zoneSensors[zone].includes(sensorId)) {
          zoneSensors[zone].push(sensorId);
        }
      }
    });
    
    if (this.sensorChanges.length > 0) {
      this.log('INFO', `检测到 ${this.sensorChanges.length} 次传感器更换`);
    }
  }

  checkTimeContinuity() {
    this.log('INFO', '检查时间连续性...');
    
    const sortedData = [...this.parsedData].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    for (let i = 1; i < sortedData.length; i++) {
      const prev = sortedData[i - 1];
      const curr = sortedData[i];
      
      if (prev.timestamp && curr.timestamp) {
        const diff = new Date(curr.timestamp) - new Date(prev.timestamp);
        const hours = diff / (1000 * 60 * 60);
        
        if (hours > 4) {
          const meta = curr._meta;
          this.addIssue('WARN', `时间间隔异常: 与前一条记录相差 ${hours.toFixed(1)} 小时`, meta.lineNumber, meta.sourceFile);
        }
      }
    }
  }

  calculateStats() {
    const zones = [...new Set(this.parsedData.map(r => r.zone).filter(z => z))];
    const statsByZone = {};
    
    zones.forEach(zone => {
      const zoneData = this.parsedData.filter(r => r.zone === zone);
      
      statsByZone[zone] = {
        recordCount: zoneData.length,
        temperature: this.calculateFieldStats(zoneData, 'temperature'),
        humidity: this.calculateFieldStats(zoneData, 'humidity'),
        co2: this.calculateFieldStats(zoneData, 'co2'),
        light: this.calculateFieldStats(zoneData, 'light'),
        soilMoisture: this.calculateFieldStats(zoneData, 'soilMoisture')
      };
    });
    
    return {
      totalRecords: this.parsedData.length,
      zones,
      statsByZone,
      issueCount: this.issues.length,
      missingCount: this.issues.filter(i => i.level === 'MISSING').length,
      warningCount: this.issues.filter(i => i.level === 'WARN').length,
      errorCount: this.issues.filter(i => i.level === 'ERROR').length
    };
  }

  calculateFieldStats(data, field) {
    const values = data.map(r => r[field]).filter(v => v !== null && v !== undefined);
    
    if (values.length === 0) {
      return { validCount: 0, missing: true };
    }
    
    return {
      validCount: values.length,
      missingCount: data.length - values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)
    };
  }

  addIssue(level, message, lineNumber, sourceFile) {
    const issue = {
      level,
      message,
      lineNumber,
      sourceFile,
      timestamp: new Date().toISOString()
    };
    this.issues.push(issue);
  }

  log(level, message) {
    this.validationResults.push({ level, message, timestamp: new Date().toISOString() });
  }
}

module.exports = GreenhouseValidator;
