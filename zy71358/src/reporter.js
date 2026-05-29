const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const PDFDocument = require('pdfkit');

class AuditReporter {
  constructor(auditResults, outputDir = './reports') {
    this.results = auditResults;
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  generateFilename(prefix, ext) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}_audit_${timestamp}.${ext}`;
  }

  exportJson() {
    const filename = this.generateFilename('metadata', 'json');
    const filepath = path.join(this.outputDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2), 'utf8');
    return { format: 'JSON', path: filepath, filename };
  }

  async exportCsv() {
    const filename = this.generateFilename('metadata', 'csv');
    const filepath = path.join(this.outputDir, filename);

    const records = this.results.items.map(item => ({
      index: item.index,
      tokenId: item.tokenId || '',
      name: item.name,
      creator: item.creator,
      status: item.status,
      errors: item.errors.join('; '),
      warnings: item.warnings.join('; '),
      checkCount: item.checks.length
    }));

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'index', title: '序号' },
        { id: 'tokenId', title: '链上编号' },
        { id: 'name', title: '作品名称' },
        { id: 'creator', title: '创作者' },
        { id: 'status', title: '审计状态' },
        { id: 'errors', title: '错误' },
        { id: 'warnings', title: '警告' },
        { id: 'checkCount', title: '检查项数' }
      ]
    });

    await csvWriter.writeRecords(records);
    return { format: 'CSV', path: filepath, filename };
  }

  exportAnomaliesCsv() {
    const filename = this.generateFilename('anomalies', 'csv');
    const filepath = path.join(this.outputDir, filename);

    const records = this.results.anomalies.map((a, idx) => ({
      no: idx + 1,
      index: a.index || a.indices?.join(',') || '',
      tokenId: a.tokenId || '',
      name: a.name || '',
      type: a.type || a.type,
      message: a.message || ''
    }));

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'no', title: '序号' },
        { id: 'index', title: '条目位置' },
        { id: 'tokenId', title: '链上编号' },
        { id: 'name', title: '作品名称' },
        { id: 'type', title: '异常类型' },
        { id: 'message', title: '异常描述' }
      ]
    });

    return csvWriter.writeRecords(records).then(() => ({
      format: 'CSV',
      type: 'anomalies',
      path: filepath,
      filename
    }));
  }

  exportPdf() {
    return new Promise((resolve, reject) => {
      const filename = this.generateFilename('metadata', 'pdf');
      const filepath = path.join(this.outputDir, filename);
      
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filepath);
      
      doc.pipe(stream);

      doc.fontSize(20).text('数字藏品元数据审计报告', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(12).text(`审计ID: ${this.results.auditId}`);
      doc.text(`审计时间: ${new Date(this.results.auditTime).toLocaleString()}`);
      doc.moveDown();

      doc.fontSize(14).text('一、审计概览', { underline: true });
      doc.moveDown();
      
      const summary = [
        [`总计项目数`, `${this.results.total}`],
        [`通过`, `${this.results.passed}`],
        [`未通过`, `${this.results.failed}`],
        [`通过率`, `${this.results.total > 0 ? ((this.results.passed / this.results.total) * 100).toFixed(2) : 0}%`],
        [`警告数`, `${this.results.warnings}`],
        [`异常数`, `${this.results.anomalies.length}`]
      ];
      
      summary.forEach(([label, value]) => {
        doc.text(`${label}: ${value}`);
      });
      
      doc.moveDown();
      
      doc.fontSize(14).text('二、异常统计', { underline: true });
      doc.moveDown();
      
      const anomalySummary = [
        [`哈希校验失败`, `${this.results.summary.hashFailures}`],
        [`编号重复`, `${this.results.summary.duplicateIds}`],
        [`权益过期`, `${this.results.summary.expiredRights}`],
        [`元数据缺失`, `${this.results.summary.missingMetadata}`]
      ];
      
      anomalySummary.forEach(([label, value]) => {
        doc.text(`${label}: ${value}`);
      });

      doc.moveDown();
      doc.fontSize(14).text('三、异常清单', { underline: true });
      doc.moveDown();

      if (this.results.anomalies.length === 0) {
        doc.text('无异常发现');
      } else {
        this.results.anomalies.slice(0, 50).forEach((a, idx) => {
          doc.fontSize(10).text(
            `${idx + 1}. [${a.type?.toUpperCase() || 'ANOMALY'}] ` +
            `${a.name || '未知'} (${a.tokenId || 'N/A'}): ` +
            `${a.message || a.type || ''}`
          );
        });
        
        if (this.results.anomalies.length > 50) {
          doc.text(`... 还有 ${this.results.anomalies.length - 50} 条异常，请查看完整报告`);
        }
      }

      doc.end();
      
      stream.on('finish', () => {
        resolve({ format: 'PDF', path: filepath, filename });
      });
      stream.on('error', reject);
    });
  }

  async exportAll() {
    const outputs = [];
    
    outputs.push(this.exportJson());
    outputs.push(await this.exportCsv());
    outputs.push(await this.exportAnomaliesCsv());
    outputs.push(await this.exportPdf());
    
    return outputs;
  }

  getReportBuffer(format) {
    switch (format.toLowerCase()) {
      case 'json':
        return Buffer.from(JSON.stringify(this.results, null, 2), 'utf8');
      default:
        return Buffer.from(JSON.stringify(this.getSummaryReport(), null, 2), 'utf8');
    }
  }

  getSummaryReport() {
    return {
      auditId: this.results.auditId,
      auditTime: this.results.auditTime,
      summary: {
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        passRate: this.results.total > 0 ? ((this.results.passed / this.results.total) * 100).toFixed(2) + '%' : '0%',
        warnings: this.results.warnings,
        anomalyCount: this.results.anomalies.length
      },
      anomalyBreakdown: this.results.summary,
      topAnomalies: this.results.anomalies.slice(0, 10)
    };
  }
}

module.exports = AuditReporter;
