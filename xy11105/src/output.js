const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');

class OutputWriter {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  escapeCSV(value) {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  writeCSV(filename, headers, rows) {
    const filepath = path.join(this.outputDir, filename);
    const lines = [
      headers.map(h => this.escapeCSV(h)).join(','),
      ...rows.map(row => row.map(cell => this.escapeCSV(cell)).join(','))
    ];
    fs.writeFileSync(filepath, lines.join('\n') + '\n', 'utf8');
    return filepath;
  }

  writeNormalResults(normalResults) {
    const rows = normalResults.map(item => [
      item.original,
      item.newName,
      item.path,
      item.date,
      item.courseName,
      item.level,
      item.status
    ]);
    return this.writeCSV(
      CONFIG.OUTPUT_FILES.NORMAL,
      CONFIG.CSV_HEADERS.NORMAL,
      rows
    );
  }

  writeAbnormalResults(abnormalResults) {
    const rows = abnormalResults.map(item => [
      item.original,
      item.path,
      item.type,
      item.description,
      item.suggestion
    ]);
    return this.writeCSV(
      CONFIG.OUTPUT_FILES.ABNORMAL,
      CONFIG.CSV_HEADERS.ABNORMAL,
      rows
    );
  }

  writeMultiPartResults(multiPartResults) {
    const rows = multiPartResults.map(item => [
      item.lessonId,
      item.partCount,
      item.files,
      item.pattern
    ]);
    return this.writeCSV(
      CONFIG.OUTPUT_FILES.MULTI_PART,
      CONFIG.CSV_HEADERS.MULTI_PART,
      rows
    );
  }

  writeTypoResults(typoResults) {
    const rows = typoResults.map(item => [
      item.original,
      item.corrected,
      `${item.position} (${item.filename})`,
      item.confidence.toFixed(2)
    ]);
    return this.writeCSV(
      CONFIG.OUTPUT_FILES.TYPO_FIXED,
      CONFIG.CSV_HEADERS.TYPO_FIXED,
      rows
    );
  }

  writeSummary(results) {
    const filepath = path.join(this.outputDir, CONFIG.OUTPUT_FILES.SUMMARY);
    const summary = [
      '='.repeat(60),
      '少儿体能馆课程录播重命名 - 处理摘要',
      '='.repeat(60),
      '',
      `处理时间: ${new Date().toLocaleString('zh-CN')}`,
      '',
      '--- 统计信息 ---',
      `正常处理文件数: ${results.normal.length}`,
      `异常文件数: ${results.abnormal.length}`,
      `多段视频课次数: ${results.multiPart.length}`,
      `错别字修正数: ${results.typoFixed.length}`,
      '',
      '--- 异常类型统计 ---',
      ...this.getAbnormalTypeStats(results.abnormal),
      '',
      '--- 多段视频详情 ---',
      ...results.multiPart.map(m => `${m.lessonId}: ${m.partCount} 段 - ${m.pattern}`),
      '',
      '='.repeat(60),
      '提示: 请重点复核 abnormal_results.csv 和 multi_part_videos.csv',
      '='.repeat(60)
    ].join('\n');
    
    fs.writeFileSync(filepath, summary, 'utf8');
    return filepath;
  }

  getAbnormalTypeStats(abnormalResults) {
    const stats = {};
    abnormalResults.forEach(item => {
      stats[item.type] = (stats[item.type] || 0) + 1;
    });
    return Object.entries(stats).map(([type, count]) => `${type}: ${count} 个`);
  }

  writeAll(results) {
    return {
      normal: this.writeNormalResults(results.normal),
      abnormal: this.writeAbnormalResults(results.abnormal),
      multiPart: this.writeMultiPartResults(results.multiPart),
      typoFixed: this.writeTypoResults(results.typoFixed),
      summary: this.writeSummary(results)
    };
  }
}

module.exports = OutputWriter;
