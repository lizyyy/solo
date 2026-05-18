const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class AppointmentReviewer {
  constructor() {
    this.processedRecords = new Map();
    this.fileHashes = new Map();
    this.defaultConfig = {
      releaseStatusField: '释放状态',
      appointmentTimeField: '预约时间',
      releaseTimeField: '释放时间',
      refundTimeField: '退费时间',
      operationTypeField: '操作类型',
      patientIdField: '患者ID',
      appointmentIdField: '预约ID',
      doctorField: '医生',
      departmentField: '科室',
      unreleasedValues: ['未释放', '未退费', '占用中'],
      falseReleasedValues: ['已释放', '已退费'],
      refundDelayThresholdHours: 24,
      manualRescheduleKeywords: ['手工改约', '人工改约', '后台改约'],
      duplicateCheckFields: ['患者ID', '预约时间', '医生']
    };
  }

  async run(options) {
    const { inputPath, outputPath, configPath, noAppend, checkIntegrity } = options;

    const config = await this.loadConfig(configPath);
    this.config = { ...this.defaultConfig, ...config };

    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    const outputFile = path.join(outputPath, 'appointment_release_review_result.csv');
    const stateFile = path.join(outputPath, '.review_state.json');

    let existingState = { processedFileHashes: {}, processedRecordIds: new Set() };
    if (fs.existsSync(stateFile) && !noAppend) {
      existingState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      existingState.processedRecordIds = new Set(existingState.processedRecordIds || []);
    }

    const inputFiles = await this.getInputFiles(inputPath);
    const validFiles = checkIntegrity ? await this.checkFileIntegrity(inputFiles, existingState) : inputFiles;

    if (validFiles.length === 0) {
      if (!fs.existsSync(outputFile) || noAppend) {
        throw new Error('没有需要处理的有效文件');
      }
      return {
        processedFiles: 0,
        unreleasedCount: 0,
        falseReleasedCount: 0,
        refundDelayCount: 0,
        manualRescheduleCount: 0,
        duplicateCount: 0,
        outputFile
      };
    }

    const results = {
      unreleased: [],
      falseReleased: [],
      refundDelay: [],
      manualReschedule: [],
      duplicate: []
    };

    let processedCount = 0;

    for (const file of validFiles) {
      console.log(`处理文件: ${path.basename(file)}`);
      const fileResults = await this.processFile(file, existingState.processedRecordIds);
      
      results.unreleased.push(...fileResults.unreleased);
      results.falseReleased.push(...fileResults.falseReleased);
      results.refundDelay.push(...fileResults.refundDelay);
      results.manualReschedule.push(...fileResults.manualReschedule);
      results.duplicate.push(...fileResults.duplicate);

      const fileHash = await this.calculateFileHash(file);
      existingState.processedFileHashes[file] = fileHash;
      processedCount++;
    }

    for (const record of results.unreleased) {
      existingState.processedRecordIds.add(this.getRecordId(record));
    }
    for (const record of results.falseReleased) {
      existingState.processedRecordIds.add(this.getRecordId(record));
    }

    await this.writeResults(outputFile, results, noAppend);

    existingState.processedRecordIds = Array.from(existingState.processedRecordIds);
    fs.writeFileSync(stateFile, JSON.stringify(existingState, null, 2), 'utf8');

    return {
      processedFiles: processedCount,
      unreleasedCount: results.unreleased.length,
      falseReleasedCount: results.falseReleased.length,
      refundDelayCount: results.refundDelay.length,
      manualRescheduleCount: results.manualReschedule.length,
      duplicateCount: results.duplicate.length,
      outputFile
    };
  }

  async loadConfig(configPath) {
    if (!configPath || !fs.existsSync(configPath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  async getInputFiles(inputPath) {
    const stats = fs.statSync(inputPath);
    if (stats.isFile()) {
      return [inputPath];
    }
    const files = fs.readdirSync(inputPath)
      .filter(f => f.endsWith('.csv'))
      .map(f => path.join(inputPath, f));
    return files;
  }

  async checkFileIntegrity(files, existingState) {
    const validFiles = [];
    for (const file of files) {
      const currentHash = await this.calculateFileHash(file);
      const storedHash = existingState.processedFileHashes[file];
      
      if (!storedHash || storedHash !== currentHash) {
        validFiles.push(file);
      } else {
        console.log(`跳过已处理且未变更的文件: ${path.basename(file)}`);
      }
    }
    return validFiles;
  }

  async calculateFileHash(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  getRecordId(record) {
    const fields = this.config.duplicateCheckFields;
    const key = fields.map(f => record[f] || '').join('|');
    return crypto.createHash('md5').update(key).digest('hex');
  }

  async processFile(filePath, processedRecordIds) {
    const results = {
      unreleased: [],
      falseReleased: [],
      refundDelay: [],
      manualReschedule: [],
      duplicate: []
    };

    const records = [];
    const seenInFile = new Map();
    let lineNumber = 1;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', () => {
          lineNumber = 2;
        })
        .on('data', (data) => {
          const record = {
            ...data,
            _sourceFile: path.basename(filePath),
            _lineNumber: lineNumber
          };
          records.push(record);
          lineNumber++;
        })
        .on('end', () => {
          for (const record of records) {
            const recordId = this.getRecordId(record);

            if (this.isUnreleased(record)) {
              if (!processedRecordIds.has(recordId)) {
                results.unreleased.push(record);
              }
            }

            if (this.isFalseReleased(record)) {
              if (!processedRecordIds.has(recordId)) {
                results.falseReleased.push(record);
              }
            }

            if (this.isRefundDelay(record)) {
              results.refundDelay.push(record);
            }

            if (this.isManualReschedule(record)) {
              results.manualReschedule.push(record);
            }

            if (seenInFile.has(recordId)) {
              results.duplicate.push(record);
              results.duplicate.push(seenInFile.get(recordId));
            } else {
              seenInFile.set(recordId, record);
            }
          }

          resolve(results);
        })
        .on('error', reject);
    });
  }

  isUnreleased(record) {
    const status = record[this.config.releaseStatusField] || '';
    return this.config.unreleasedValues.some(v => status.includes(v));
  }

  isFalseReleased(record) {
    const status = record[this.config.releaseStatusField] || '';
    const hasReleaseTime = record[this.config.releaseTimeField] && record[this.config.releaseTimeField] !== '';
    const hasAppointment = record[this.config.appointmentIdField] && record[this.config.appointmentIdField] !== '';
    
    return this.config.falseReleasedValues.some(v => status.includes(v)) 
           && !hasReleaseTime 
           && hasAppointment;
  }

  isRefundDelay(record) {
    const releaseTime = record[this.config.releaseTimeField];
    const refundTime = record[this.config.refundTimeField];
    
    if (!releaseTime || !refundTime) return false;

    try {
      const releaseDate = new Date(releaseTime);
      const refundDate = new Date(refundTime);
      const diffHours = (refundDate - releaseDate) / (1000 * 60 * 60);
      return diffHours > this.config.refundDelayThresholdHours;
    } catch {
      return false;
    }
  }

  isManualReschedule(record) {
    const operationType = record[this.config.operationTypeField] || '';
    return this.config.manualRescheduleKeywords.some(k => operationType.includes(k));
  }

  async writeResults(outputFile, results, noAppend) {
    const header = [
      { id: 'reviewType', title: '复盘类型' },
      { id: 'patientId', title: '患者ID' },
      { id: 'appointmentId', title: '预约ID' },
      { id: 'department', title: '科室' },
      { id: 'doctor', title: '医生' },
      { id: 'appointmentTime', title: '预约时间' },
      { id: 'releaseStatus', title: '释放状态' },
      { id: 'releaseTime', title: '释放时间' },
      { id: 'refundTime', title: '退费时间' },
      { id: 'operationType', title: '操作类型' },
      { id: 'sourceFile', title: '原始文件名' },
      { id: 'lineNumber', title: '原始行号' },
      { id: 'reviewDate', title: '复盘日期' }
    ];

    const records = [];
    const reviewDate = new Date().toISOString().split('T')[0];

    results.unreleased.forEach(r => {
      records.push({
        reviewType: '未释放号源',
        patientId: r[this.config.patientIdField] || '',
        appointmentId: r[this.config.appointmentIdField] || '',
        department: r[this.config.departmentField] || '',
        doctor: r[this.config.doctorField] || '',
        appointmentTime: r[this.config.appointmentTimeField] || '',
        releaseStatus: r[this.config.releaseStatusField] || '',
        releaseTime: r[this.config.releaseTimeField] || '',
        refundTime: r[this.config.refundTimeField] || '',
        operationType: r[this.config.operationTypeField] || '',
        sourceFile: r._sourceFile,
        lineNumber: r._lineNumber,
        reviewDate
      });
    });

    results.falseReleased.forEach(r => {
      records.push({
        reviewType: '误释放号源',
        patientId: r[this.config.patientIdField] || '',
        appointmentId: r[this.config.appointmentIdField] || '',
        department: r[this.config.departmentField] || '',
        doctor: r[this.config.doctorField] || '',
        appointmentTime: r[this.config.appointmentTimeField] || '',
        releaseStatus: r[this.config.releaseStatusField] || '',
        releaseTime: r[this.config.releaseTimeField] || '',
        refundTime: r[this.config.refundTimeField] || '',
        operationType: r[this.config.operationTypeField] || '',
        sourceFile: r._sourceFile,
        lineNumber: r._lineNumber,
        reviewDate
      });
    });

    results.refundDelay.forEach(r => {
      records.push({
        reviewType: '退费延迟',
        patientId: r[this.config.patientIdField] || '',
        appointmentId: r[this.config.appointmentIdField] || '',
        department: r[this.config.departmentField] || '',
        doctor: r[this.config.doctorField] || '',
        appointmentTime: r[this.config.appointmentTimeField] || '',
        releaseStatus: r[this.config.releaseStatusField] || '',
        releaseTime: r[this.config.releaseTimeField] || '',
        refundTime: r[this.config.refundTimeField] || '',
        operationType: r[this.config.operationTypeField] || '',
        sourceFile: r._sourceFile,
        lineNumber: r._lineNumber,
        reviewDate
      });
    });

    results.manualReschedule.forEach(r => {
      records.push({
        reviewType: '手工改约',
        patientId: r[this.config.patientIdField] || '',
        appointmentId: r[this.config.appointmentIdField] || '',
        department: r[this.config.departmentField] || '',
        doctor: r[this.config.doctorField] || '',
        appointmentTime: r[this.config.appointmentTimeField] || '',
        releaseStatus: r[this.config.releaseStatusField] || '',
        releaseTime: r[this.config.releaseTimeField] || '',
        refundTime: r[this.config.refundTimeField] || '',
        operationType: r[this.config.operationTypeField] || '',
        sourceFile: r._sourceFile,
        lineNumber: r._lineNumber,
        reviewDate
      });
    });

    results.duplicate.forEach(r => {
      records.push({
        reviewType: '重复占号',
        patientId: r[this.config.patientIdField] || '',
        appointmentId: r[this.config.appointmentIdField] || '',
        department: r[this.config.departmentField] || '',
        doctor: r[this.config.doctorField] || '',
        appointmentTime: r[this.config.appointmentTimeField] || '',
        releaseStatus: r[this.config.releaseStatusField] || '',
        releaseTime: r[this.config.releaseTimeField] || '',
        refundTime: r[this.config.refundTimeField] || '',
        operationType: r[this.config.operationTypeField] || '',
        sourceFile: r._sourceFile,
        lineNumber: r._lineNumber,
        reviewDate
      });
    });

    const fileExists = fs.existsSync(outputFile);
    const append = fileExists && !noAppend;

    if (append) {
      const existingContent = fs.readFileSync(outputFile, 'utf8');
      const lines = existingContent.trim().split('\n');
      const existingRecords = lines.slice(1).map(line => {
        const values = line.split(',');
        return values.join(',');
      });

      const newRecords = records.map(r => [
        r.reviewType,
        r.patientId,
        r.appointmentId,
        r.department,
        r.doctor,
        r.appointmentTime,
        r.releaseStatus,
        r.releaseTime,
        r.refundTime,
        r.operationType,
        r.sourceFile,
        r.lineNumber,
        r.reviewDate
      ].join(','));

      const uniqueNewRecords = newRecords.filter(nr => !existingRecords.includes(nr));
      
      if (uniqueNewRecords.length > 0) {
        fs.appendFileSync(outputFile, '\n' + uniqueNewRecords.join('\n'), 'utf8');
      }
    } else {
      const csvWriter = createCsvWriter({
        path: outputFile,
        header
      });
      await csvWriter.writeRecords(records);
    }

    const hash = crypto.createHash('md5').update(fs.readFileSync(outputFile)).digest('hex');
    const hashFile = outputFile + '.md5';
    fs.writeFileSync(hashFile, hash, 'utf8');
  }

  async verifyResultFile(filePath) {
    const hashFile = filePath + '.md5';
    if (!fs.existsSync(hashFile)) {
      console.log('警告: 找不到哈希校验文件');
      return true;
    }

    const storedHash = fs.readFileSync(hashFile, 'utf8').trim();
    const currentHash = crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');

    return storedHash === currentHash;
  }

  async initSample(targetPath) {
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    const sampleData = `患者ID,预约ID,科室,医生,预约时间,释放状态,释放时间,退费时间,操作类型
P001,A001,心内科,张医生,2024-01-15 09:00,未释放,,,系统预约
P002,A002,骨科,李医生,2024-01-15 10:00,已释放,,,系统预约
P003,A003,皮肤科,王医生,2024-01-15 11:00,已释放,2024-01-14 08:00,2024-01-15 12:00,系统取消
P004,A004,心内科,张医生,2024-01-16 09:00,未释放,,,手工改约
P001,A001,心内科,张医生,2024-01-15 09:00,未释放,,,系统预约
P005,A005,内科,刘医生,2024-01-17 14:00,已释放,2024-01-16 10:00,2024-01-18 09:00,系统退费`;

    fs.writeFileSync(path.join(targetPath, 'sample_appointments.csv'), sampleData, 'utf8');

    const config = {
      releaseStatusField: '释放状态',
      appointmentTimeField: '预约时间',
      releaseTimeField: '释放时间',
      refundTimeField: '退费时间',
      operationTypeField: '操作类型',
      patientIdField: '患者ID',
      appointmentIdField: '预约ID',
      doctorField: '医生',
      departmentField: '科室',
      unreleasedValues: ['未释放', '未退费', '占用中'],
      falseReleasedValues: ['已释放', '已退费'],
      refundDelayThresholdHours: 24,
      manualRescheduleKeywords: ['手工改约', '人工改约', '后台改约'],
      duplicateCheckFields: ['患者ID', '预约时间', '医生']
    };

    fs.writeFileSync(path.join(targetPath, 'config.json'), JSON.stringify(config, null, 2), 'utf8');
  }
}

module.exports = AppointmentReviewer;
