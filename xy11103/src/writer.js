import fs from 'fs';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { format } from 'date-fns';

class ResultWriter {
  constructor(config) {
    this.config = config;
    this.ensureOutputDirectory();
  }

  ensureOutputDirectory() {
    const outputDir = this.config.output.directory;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  async writeResults(processResult, parseResult) {
    const promises = [
      this.writeAuditResult(processResult.records),
      this.writeCrossDayRecords(processResult.crossDayRecords),
      this.writeRetransmittedRecords(processResult.retransmittedRecords),
      this.writeDeduplicatedRecords(processResult.deduplicatedRecords),
      this.writeErrorReport(parseResult.errors),
      this.writeSummary(processResult.stats, parseResult),
      this.saveProcessedHashes(processResult.records)
    ];

    await Promise.all(promises);
  }

  async writeAuditResult(records) {
    if (records.length === 0) return;

    const outputPath = path.join(this.config.output.directory, this.config.output.auditResult);
    const existingRecords = await this.readExistingRecords(outputPath);

    const newRecords = records.map(record => ({
      recordHash: record.recordHash,
      employeeId: record.employeeId,
      employeeName: record.employeeName || '',
      roomId: record.roomId,
      roomName: record.roomName || '',
      accessDate: record.accessDate,
      accessTime: record.accessTimeStr,
      accessType: record.accessType || '',
      deviceId: record.deviceId || '',
      sourceFile: record.sourceFile,
      auditTime: format(record.auditTime, 'yyyy-MM-dd HH:mm:ss')
    }));

    const allRecords = [...existingRecords, ...newRecords];

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'recordHash', title: '记录哈希' },
        { id: 'employeeId', title: '员工ID' },
        { id: 'employeeName', title: '员工姓名' },
        { id: 'roomId', title: '会议室ID' },
        { id: 'roomName', title: '会议室名称' },
        { id: 'accessDate', title: '门禁日期' },
        { id: 'accessTime', title: '门禁时间' },
        { id: 'accessType', title: '出入类型' },
        { id: 'deviceId', title: '设备ID' },
        { id: 'sourceFile', title: '来源文件' },
        { id: 'auditTime', title: '核对时间' }
      ],
      encoding: this.config.input.encoding
    });

    await csvWriter.writeRecords(allRecords);
  }

  async writeCrossDayRecords(records) {
    if (records.length === 0) return;

    const outputPath = path.join(this.config.output.directory, this.config.output.crossDayRecords);

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'employeeId', title: '员工ID' },
        { id: 'employeeName', title: '员工姓名' },
        { id: 'roomId', title: '会议室ID' },
        { id: 'roomName', title: '会议室名称' },
        { id: 'accessTime', title: '门禁时间' },
        { id: 'pairedRecord', title: '配对记录哈希' },
        { id: 'durationMinutes', title: '跨天时长(分钟)' },
        { id: 'crossDays', title: '跨天天数' },
        { id: 'sourceFile', title: '来源文件' }
      ],
      encoding: this.config.input.encoding
    });

    const formattedRecords = records.map(record => ({
      employeeId: record.employeeId,
      employeeName: record.employeeName || '',
      roomId: record.roomId,
      roomName: record.roomName || '',
      accessTime: format(record.accessTime, 'yyyy-MM-dd HH:mm:ss'),
      pairedRecord: record.crossDayInfo.pairedRecord,
      durationMinutes: record.crossDayInfo.durationMinutes,
      crossDays: record.crossDayInfo.crossDays,
      sourceFile: record.sourceFile
    }));

    await csvWriter.writeRecords(formattedRecords);
  }

  async writeRetransmittedRecords(records) {
    if (records.length === 0) return;

    const outputPath = path.join(this.config.output.directory, this.config.output.retransmittedRecords);

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'employeeId', title: '员工ID' },
        { id: 'employeeName', title: '员工姓名' },
        { id: 'roomId', title: '会议室ID' },
        { id: 'roomName', title: '会议室名称' },
        { id: 'accessTime', title: '补传时间' },
        { id: 'originalRecord', title: '原始记录哈希' },
        { id: 'originalTime', title: '原始时间' },
        { id: 'timeDiffMinutes', title: '时间差(分钟)' },
        { id: 'similarity', title: '相似度' },
        { id: 'sourceFile', title: '来源文件' }
      ],
      encoding: this.config.input.encoding
    });

    const formattedRecords = records.map(record => ({
      employeeId: record.employeeId,
      employeeName: record.employeeName || '',
      roomId: record.roomId,
      roomName: record.roomName || '',
      accessTime: format(record.accessTime, 'yyyy-MM-dd HH:mm:ss'),
      originalRecord: record.retransmissionInfo.originalRecord,
      originalTime: record.retransmissionInfo.originalTime,
      timeDiffMinutes: record.retransmissionInfo.timeDiffMinutes,
      similarity: record.retransmissionInfo.similarity,
      sourceFile: record.sourceFile
    }));

    await csvWriter.writeRecords(formattedRecords);
  }

  async writeDeduplicatedRecords(records) {
    if (records.length === 0) return;

    const outputPath = path.join(this.config.output.directory, this.config.output.deduplicatedRecords);

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'employeeId', title: '员工ID' },
        { id: 'employeeName', title: '员工姓名' },
        { id: 'roomId', title: '会议室ID' },
        { id: 'roomName', title: '会议室名称' },
        { id: 'accessTime', title: '门禁时间' },
        { id: 'duplicateHash', title: '重复哈希' },
        { id: 'duplicateFields', title: '重复字段' },
        { id: 'sourceFile', title: '来源文件' }
      ],
      encoding: this.config.input.encoding
    });

    const formattedRecords = records.map(record => ({
      employeeId: record.employeeId,
      employeeName: record.employeeName || '',
      roomId: record.roomId,
      roomName: record.roomName || '',
      accessTime: format(record.accessTime, 'yyyy-MM-dd HH:mm:ss'),
      duplicateHash: record.duplicateInfo.hash,
      duplicateFields: record.duplicateInfo.duplicateFields,
      sourceFile: record.sourceFile
    }));

    await csvWriter.writeRecords(formattedRecords);
  }

  async writeErrorReport(errors) {
    const outputPath = path.join(this.config.output.directory, this.config.output.errorReport);

    const report = {
      generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      totalErrorFiles: errors.length,
      totalErrors: errors.reduce((sum, e) => sum + e.errors.length, 0),
      errors: errors
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  }

  async writeSummary(stats, parseResult) {
    const summaryPath = path.join(this.config.output.directory, 'summary.txt');

    const summary = [
      '='.repeat(60),
      '共享会议室门禁日志核对报告',
      '='.repeat(60),
      '',
      `生成时间: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`,
      '',
      `原始记录总数: ${stats.total}`,
      `核对后记录数: ${stats.afterDeduplication}`,
      `去重记录数: ${stats.deduplicatedCount}`,
      `跨天记录数: ${stats.crossDayCount}`,
      `补传记录数: ${stats.retransmittedCount}`,
      '',
      `处理文件数: ${parseResult.results.length}`,
      `错误文件数: ${parseResult.errors.length}`,
      `总错误数: ${parseResult.totalErrors}`,
      '',
      '='.repeat(60),
      '',
      '问题重点:',
      `1. 跨天记录: 共 ${stats.crossDayCount} 条，请检查是否有异常跨天使用`,
      `2. 门禁补传: 共 ${stats.retransmittedCount} 条，请核实是否为网络延迟导致的补传`,
      `3. 重复记录: 共 ${stats.deduplicatedCount} 条，已自动去重确保可复跑不重复追加`,
      '',
      '='.repeat(60)
    ].join('\n');

    fs.writeFileSync(summaryPath, summary, 'utf-8');
    console.log(summary);
  }

  async readExistingRecords(outputPath) {
    if (!fs.existsSync(outputPath)) {
      return [];
    }

    const existingHashes = this.loadProcessedHashes();
    const hashSet = new Set(existingHashes);

    return [];
  }

  saveProcessedHashes(records) {
    const hashPath = path.join(this.config.output.directory, '.processed_hashes.json');
    
    let existingHashes = [];
    if (fs.existsSync(hashPath)) {
      try {
        const content = fs.readFileSync(hashPath, 'utf-8');
        existingHashes = JSON.parse(content);
      } catch (error) {
        existingHashes = [];
      }
    }

    const newHashes = records.map(r => r.recordHash);
    const allHashes = [...new Set([...existingHashes, ...newHashes])];

    fs.writeFileSync(hashPath, JSON.stringify(allHashes, null, 2), 'utf-8');
  }

  loadProcessedHashes() {
    const hashPath = path.join(this.config.output.directory, '.processed_hashes.json');
    
    if (!fs.existsSync(hashPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(hashPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return [];
    }
  }
}

export default ResultWriter;
