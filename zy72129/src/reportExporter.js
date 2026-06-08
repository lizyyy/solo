const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const XLSX = require('xlsx');
const config = require('./config');

class ReportExporter {
  constructor(outputDir = config.paths.output) {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  generateFileName(prefix, extension) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${prefix}_${timestamp}.${extension}`;
  }

  async exportToCsv(reviewData, fileNamePrefix = 'loudness_review') {
    const records = this.formatRecords(reviewData);
    const fileName = this.generateFileName(fileNamePrefix, 'csv');
    const filePath = path.join(this.outputDir, fileName);
    
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'trackId', title: '序号' },
        { id: 'title', title: '曲目' },
        { id: 'artist', title: '表演者' },
        { id: 'fileName', title: '文件名' },
        { id: 'status', title: '审查状态' },
        { id: 'loudnessLUFS', title: '响度(LUFS)' },
        { id: 'peakDB', title: '峰值(dB)' },
        { id: 'reviewReason', title: '审查原因' },
        { id: 'notes', title: '批注' },
        { id: 'source', title: '数据来源' },
        { id: 'processedAt', title: '处理时间' },
        { id: 'duration', title: '时长(秒)' }
      ]
    });
    
    await csvWriter.writeRecords(records);
    return { filePath, fileName, recordCount: records.length };
  }

  exportToJson(reviewData, fileNamePrefix = 'loudness_review') {
    const fileName = this.generateFileName(fileNamePrefix, 'json');
    const filePath = path.join(this.outputDir, fileName);
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      summary: this.generateSummary(reviewData),
      records: reviewData
    };
    
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf8');
    return { filePath, fileName, recordCount: reviewData.length };
  }

  exportToExcel(reviewData, fileNamePrefix = 'loudness_review') {
    const fileName = this.generateFileName(fileNamePrefix, 'xlsx');
    const filePath = path.join(this.outputDir, fileName);
    
    const records = this.formatRecords(reviewData);
    const worksheet = XLSX.utils.json_to_sheet(records);
    const workbook = XLSX.utils.book_new();
    
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 20 },
      { wch: 15 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 40 },
      { wch: 30 },
      { wch: 20 },
      { wch: 25 },
      { wch: 12 }
    ];
    
    XLSX.utils.book_append_sheet(workbook, worksheet, '响度审查结果');
    
    const summarySheet = XLSX.utils.json_to_sheet([this.generateSummary(reviewData)]);
    XLSX.utils.book_append_sheet(workbook, summarySheet, '汇总');
    
    XLSX.writeFile(workbook, filePath);
    return { filePath, fileName, recordCount: reviewData.length };
  }

  formatRecords(reviewData) {
    return reviewData.map(item => ({
      trackId: item.trackId || '',
      title: item.title || '',
      artist: item.artist || '',
      fileName: item.fileName || '',
      status: item.status || '',
      loudnessLUFS: item.loudness?.inputLUFS?.toFixed(2) || '',
      peakDB: item.loudness?.inputPeak?.toFixed(2) || '',
      reviewReason: this.formatReasons(item.reviewReasons || []),
      notes: this.formatNotes(item.notes || []),
      source: item.source || '',
      processedAt: item.processedAt || '',
      duration: item.metadata?.duration?.toFixed(1) || ''
    }));
  }

  formatReasons(reasons) {
    if (!reasons || reasons.length === 0) return '正常';
    return reasons.join('; ');
  }

  formatNotes(notes) {
    if (!notes || notes.length === 0) return '';
    return notes.map(n => 
      n.source ? `[${n.source}] ${n.note}` : n.note
    ).join(' | ');
  }

  generateSummary(reviewData) {
    const statusCounts = {};
    reviewData.forEach(item => {
      const status = item.status || '未知';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    return {
      总记录数: reviewData.length,
      处理时间: new Date().toISOString(),
      ...statusCounts
    };
  }

  async exportAll(reviewData, fileNamePrefix = 'loudness_review') {
    const csv = await this.exportToCsv(reviewData, fileNamePrefix);
    const json = this.exportToJson(reviewData, fileNamePrefix);
    const excel = this.exportToExcel(reviewData, fileNamePrefix);
    return { csv, json, excel };
  }
}

module.exports = ReportExporter;
