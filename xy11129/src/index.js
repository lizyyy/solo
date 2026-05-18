const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const REQUIRED_FIELDS = ['timestamp', 'latitude', 'longitude', 'altitude', 'speed', 'rider_id', 'ride_id'];

class TraceCleaner {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.join(process.cwd(), 'data', 'output');
    this.errorLog = [];
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      duplicateRecords: 0,
      powerLossEvents: 0,
      reverseRouteEvents: 0
    };
  }

  async processFile(filePath) {
    this.stats.totalFiles++;
    const fileErrors = [];
    const records = [];
    const seenKeys = new Set();

    return new Promise((resolve) => {
      if (!fs.existsSync(filePath)) {
        fileErrors.push({ type: 'FILE_NOT_FOUND', message: `文件不存在: ${filePath}` });
        this.errorLog.push(...fileErrors.map(e => ({ ...e, file: filePath })));
        this.stats.failedFiles++;
        resolve({ success: false, errors: fileErrors, records: [] });
        return;
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        fileErrors.push({ type: 'EMPTY_FILE', message: `空文件: ${filePath}` });
        this.errorLog.push(...fileErrors.map(e => ({ ...e, file: filePath })));
        this.stats.failedFiles++;
        resolve({ success: false, errors: fileErrors, records: [] });
        return;
      }

      fs.createReadStream(filePath, { encoding: 'utf-8' })
        .on('error', (err) => {
          if (err.code === 'ENOENT') {
            fileErrors.push({ type: 'FILE_NOT_FOUND', message: `文件不存在: ${filePath}` });
          } else if (err.code === 'EACCES') {
            fileErrors.push({ type: 'PERMISSION_DENIED', message: `无权限读取文件: ${filePath}` });
          } else {
            fileErrors.push({ type: 'ENCODING_ERROR', message: `文件编码异常: ${filePath} - ${err.message}` });
          }
          this.errorLog.push(...fileErrors.map(e => ({ ...e, file: filePath })));
          this.stats.failedFiles++;
          resolve({ success: false, errors: fileErrors, records: [] });
        })
        .pipe(csv())
        .on('headers', (headers) => {
          const missingFields = REQUIRED_FIELDS.filter(f => !headers.includes(f));
          if (missingFields.length > 0) {
            fileErrors.push({ 
              type: 'MISSING_COLUMNS', 
              message: `缺少必需列: ${missingFields.join(', ')}`,
              missingFields 
            });
          }
        })
        .on('data', (data) => {
          this.stats.totalRecords++;
          
          const recordErrors = this.validateRecord(data);
          if (recordErrors.length > 0) {
            this.stats.invalidRecords++;
            fileErrors.push({
              type: 'INVALID_RECORD',
              message: `无效记录行 ${records.length + 1}`,
              errors: recordErrors,
              record: data
            });
            return;
          }

          const duplicateKey = `${data.rider_id}_${data.ride_id}_${data.timestamp}`;
          if (seenKeys.has(duplicateKey)) {
            this.stats.duplicateRecords++;
            fileErrors.push({
              type: 'DUPLICATE_RECORD',
              message: `重复记录行 ${records.length + 1}`,
              record: data
            });
            return;
          }
          seenKeys.add(duplicateKey);

          records.push(data);
          this.stats.validRecords++;
        })
        .on('end', () => {
          const powerLossCount = this.detectPowerLoss(records);
          const reverseCount = this.detectReverseRoute(records);
          
          this.stats.powerLossEvents += powerLossCount;
          this.stats.reverseRouteEvents += reverseCount;

          if (powerLossCount > 0) {
            fileErrors.push({
              type: 'POWER_LOSS_DETECTED',
              message: `检测到 ${powerLossCount} 次设备断电事件`,
              count: powerLossCount
            });
          }

          if (reverseCount > 0) {
            fileErrors.push({
              type: 'REVERSE_ROUTE_DETECTED',
              message: `检测到 ${reverseCount} 次路线反向异常`,
              count: reverseCount
            });
          }

          this.errorLog.push(...fileErrors.map(e => ({ ...e, file: filePath })));
          this.stats.processedFiles++;
          resolve({ success: true, errors: fileErrors, records });
        })
        .on('error', (err) => {
          fileErrors.push({ type: 'PARSE_ERROR', message: `CSV解析错误: ${err.message}` });
          this.stats.failedFiles++;
          resolve({ success: false, errors: fileErrors, records: [] });
        });
    });
  }

  validateRecord(record) {
    const errors = [];
    
    for (const field of REQUIRED_FIELDS) {
      if (!record[field] || record[field].toString().trim() === '') {
        errors.push(`字段 '${field}' 为空或缺失`);
      }
    }

    if (record.latitude) {
      const lat = parseFloat(record.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errors.push('纬度值无效');
      }
    }

    if (record.longitude) {
      const lng = parseFloat(record.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        errors.push('经度值无效');
      }
    }

    if (record.speed) {
      const speed = parseFloat(record.speed);
      if (isNaN(speed) || speed < 0 || speed > 150) {
        errors.push('速度值无效（应为0-150 km/h）');
      }
    }

    return errors;
  }

  detectPowerLoss(records) {
    if (records.length < 2) return 0;
    let count = 0;
    
    for (let i = 1; i < records.length; i++) {
      const prevTime = new Date(records[i - 1].timestamp).getTime();
      const currTime = new Date(records[i].timestamp).getTime();
      const gapMinutes = (currTime - prevTime) / 60000;
      
      if (gapMinutes > 30) {
        count++;
      }
    }
    
    return count;
  }

  detectReverseRoute(records) {
    if (records.length < 5) return 0;
    let reverseCount = 0;
    let consecutiveDecreases = 0;
    
    for (let i = 1; i < records.length; i++) {
      const prevDist = this.calculateDistance(records[0], records[i - 1]);
      const currDist = this.calculateDistance(records[0], records[i]);
      
      if (currDist < prevDist) {
        consecutiveDecreases++;
        if (consecutiveDecreases >= 3) {
          reverseCount++;
          consecutiveDecreases = 0;
        }
      } else {
        consecutiveDecreases = 0;
      }
    }
    
    return reverseCount;
  }

  calculateDistance(point1, point2) {
    const R = 6371;
    const dLat = this.toRad(point2.latitude - point1.latitude);
    const dLon = this.toRad(point2.longitude - point1.longitude);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(point1.latitude)) * Math.cos(this.toRad(point2.latitude)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  async writeCleanedRecords(records, outputFileName) {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const csvWriter = createCsvWriter({
      path: path.join(this.outputDir, outputFileName),
      header: REQUIRED_FIELDS.map(f => ({ id: f, title: f }))
    });

    await csvWriter.writeRecords(records);
  }

  async writeErrorLog(outputFileName = 'error_log.json') {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(this.outputDir, outputFileName),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        stats: this.stats,
        errors: this.errorLog
      }, null, 2)
    );
  }

  getStats() {
    return { ...this.stats };
  }

  getErrors() {
    return [...this.errorLog];
  }
}

module.exports = TraceCleaner;
