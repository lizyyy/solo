const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const LogEntry = require('../models/LogEntry');
const AnalysisReport = require('../models/AnalysisReport');
const LogReplayService = require('./LogReplayService');

class ReportService {
  static async generateReport(filters, format, createdBy = 'system') {
    const logs = await this.queryLogs(filters);
    const statistics = await this.analyzeLogs(logs);
    
    const report = await this.createReportRecord(filters, statistics, logs, createdBy);

    switch (format) {
      case 'excel':
        return this.exportToExcel(report, logs);
      case 'markdown':
        return this.exportToMarkdown(report, logs);
      case 'pdf':
        return this.exportToPDF(report, logs);
      default:
        return report;
    }
  }

  static async queryLogs(filters) {
    const query = {};
    
    if (filters.startTime && filters.endTime) {
      query.timestamp = {
        $gte: new Date(filters.startTime),
        $lte: new Date(filters.endTime)
      };
    }
    
    if (filters.level) {
      query.level = filters.level;
    }
    
    if (filters.service) {
      query.service = filters.service;
    }
    
    if (filters.userId) {
      query.userId = filters.userId;
    }
    
    if (filters.traceId) {
      query.traceId = filters.traceId;
    }
    
    if (filters.anomalies && filters.anomalies.length > 0) {
      query.anomalies = { $in: filters.anomalies };
    }

    return await LogEntry.find(query).sort({ timestamp: -1 }).limit(10000);
  }

  static async analyzeLogs(logs) {
    const statistics = {
      totalLogs: logs.length,
      errorCount: 0,
      warningCount: 0,
      anomalyCount: 0,
      byLevel: {},
      byService: {},
      byStatus: {},
      anomalies: {},
      timeRange: {
        start: null,
        end: null
      }
    };

    const serviceCounts = {};
    const anomalyCounts = {};

    logs.forEach(log => {
      statistics.byLevel[log.level] = (statistics.byLevel[log.level] || 0) + 1;
      statistics.byService[log.service] = (statistics.byService[log.service] || 0) + 1;
      statistics.byStatus[log.status] = (statistics.byStatus[log.status] || 0) + 1;

      if (log.level === 'ERROR' || log.level === 'FATAL') {
        statistics.errorCount++;
      }
      if (log.level === 'WARN') {
        statistics.warningCount++;
      }

      if (log.anomalies && log.anomalies.length > 0) {
        statistics.anomalyCount++;
        log.anomalies.forEach(type => {
          anomalyCounts[type] = (anomalyCounts[type] || 0) + 1;
        });
      }

      serviceCounts[log.service] = (serviceCounts[log.service] || 0) + 1;

      if (!statistics.timeRange.start || log.timestamp < statistics.timeRange.start) {
        statistics.timeRange.start = log.timestamp;
      }
      if (!statistics.timeRange.end || log.timestamp > statistics.timeRange.end) {
        statistics.timeRange.end = log.timestamp;
      }
    });

    statistics.topServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([service]) => service);

    statistics.anomalies = Object.entries(anomalyCounts).map(([type, count]) => ({
      type,
      count,
      description: this.getAnomalyDescription(type),
      examples: logs
        .filter(log => log.anomalies && log.anomalies.includes(type))
        .slice(0, 5)
        .map(log => ({
          traceId: log.traceId,
          message: log.message,
          timestamp: log.timestamp
        }))
    }));

    return statistics;
  }

  static getAnomalyDescription(type) {
    const descriptions = {
      DUPLICATE: '重复操作检测',
      CONCURRENCY: '并发冲突',
      TIMING_ISSUE: '时序问题',
      CACHE_STALE: '缓存过期或未更新',
      ROLLBACK_FAILED: '数据回滚失败',
      ASYNC_OUT_OF_ORDER: '异步任务顺序错乱'
    };
    return descriptions[type] || type;
  }

  static async createReportRecord(filters, statistics, logs, createdBy) {
    const { v4: uuidv4 } = require('uuid');
    
    const topTraces = await this.getTopTraces(logs);

    const report = await AnalysisReport.create({
      reportId: uuidv4(),
      title: `日志分析报告 - ${new Date().toISOString()}`,
      createdBy,
      filters,
      summary: {
        totalLogs: statistics.totalLogs,
        errorCount: statistics.errorCount,
        warningCount: statistics.warningCount,
        anomalyCount: statistics.anomalyCount,
        topServices: statistics.topServices,
        timeRange: statistics.timeRange
      },
      statistics,
      anomalies: statistics.anomalies,
      topTraces
    });

    return report;
  }

  static async getTopTraces(logs) {
    const traceMap = new Map();
    
    logs.forEach(log => {
      if (!traceMap.has(log.traceId)) {
        traceMap.set(log.traceId, {
          traceId: log.traceId,
          status: 'UNKNOWN',
          duration: 0,
          anomalyCount: 0,
          logs: []
        });
      }
      
      const trace = traceMap.get(log.traceId);
      trace.logs.push(log);
      
      if (log.anomalies && log.anomalies.length > 0) {
        trace.anomalyCount += log.anomalies.length;
      }
      
      if (log.level === 'ERROR' || log.level === 'FATAL') {
        trace.status = 'FAILED';
      } else if (log.anomalies && log.anomalies.length > 0) {
        trace.status = 'PARTIAL';
      } else if (trace.status === 'UNKNOWN') {
        trace.status = 'COMPLETED';
      }
    });

    return Array.from(traceMap.values())
      .sort((a, b) => b.anomalyCount - a.anomalyCount)
      .slice(0, 20)
      .map(({ logs: _, ...trace }) => trace);
  }

  static async exportToExcel(report, logs) {
    const fields = [
      'timestamp',
      'traceId',
      'spanId',
      'level',
      'service',
      'operation',
      'status',
      'message',
      'userId',
      'duration',
      'anomalies'
    ];

    const logData = logs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      traceId: log.traceId,
      spanId: log.spanId,
      level: log.level,
      service: log.service,
      operation: log.operation,
      status: log.status,
      message: log.message,
      userId: log.userId || '',
      duration: log.duration,
      anomalies: (log.anomalies || []).join(', ')
    }));

    const parser = new Parser({ fields });
    const csv = parser.parse(logData);

    const filePath = path.join(__dirname, '../../exports', `${report.reportId}.csv`);
    fs.writeFileSync(filePath, csv);

    return {
      report,
      filePath,
      format: 'excel'
    };
  }

  static async exportToMarkdown(report, logs) {
    let md = `# 日志分析报告\n\n`;
    md += `**报告ID**: ${report.reportId}\n`;
    md += `**生成时间**: ${new Date().toISOString()}\n`;
    md += `**时间范围**: ${report.summary.timeRange.start?.toISOString() || 'N/A'} 至 ${report.summary.timeRange.end?.toISOString() || 'N/A'}\n\n`;

    md += `## 概览\n\n`;
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 总日志数 | ${report.summary.totalLogs} |\n`;
    md += `| 错误数 | ${report.summary.errorCount} |\n`;
    md += `| 警告数 | ${report.summary.warningCount} |\n`;
    md += `| 异常数 | ${report.summary.anomalyCount} |\n\n`;

    if (report.anomalies && report.anomalies.length > 0) {
      md += `## 异常分析\n\n`;
      report.anomalies.forEach(anomaly => {
        md += `### ${anomaly.description} (${anomaly.count} 次)\n\n`;
        if (anomaly.examples && anomaly.examples.length > 0) {
          md += `**示例:**\n\n`;
          anomaly.examples.forEach((example, idx) => {
            md += `${idx + 1}. Trace: ${example.traceId} - ${example.message}\n`;
          });
          md += `\n`;
        }
      });
    }

    if (report.topTraces && report.topTraces.length > 0) {
      md += `## 关键追踪\n\n`;
      md += `| Trace ID | 状态 | 异常数 |\n`;
      md += `|----------|------|--------|\n`;
      report.topTraces.forEach(trace => {
        md += `| ${trace.traceId} | ${trace.status} | ${trace.anomalyCount} |\n`;
      });
    }

    const filePath = path.join(__dirname, '../../exports', `${report.reportId}.md`);
    fs.writeFileSync(filePath, md);

    return {
      report,
      filePath,
      format: 'markdown'
    };
  }

  static async exportToPDF(report, logs) {
    const doc = new PDFDocument();
    const filePath = path.join(__dirname, '../../exports', `${report.reportId}.pdf`);
    
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      doc.fontSize(20).text('日志分析报告', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(12);
      doc.text(`报告ID: ${report.reportId}`);
      doc.text(`生成时间: ${new Date().toISOString()}`);
      doc.moveDown();

      doc.fontSize(16).text('概览');
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`总日志数: ${report.summary.totalLogs}`);
      doc.text(`错误数: ${report.summary.errorCount}`);
      doc.text(`警告数: ${report.summary.warningCount}`);
      doc.text(`异常数: ${report.summary.anomalyCount}`);
      doc.moveDown();

      if (report.anomalies && report.anomalies.length > 0) {
        doc.fontSize(16).text('异常分析');
        doc.moveDown();
        report.anomalies.forEach(anomaly => {
          doc.fontSize(14).text(`${anomaly.description} (${anomaly.count} 次)`);
          doc.fontSize(12);
          if (anomaly.examples && anomaly.examples.length > 0) {
            doc.text('示例:');
            anomaly.examples.forEach((example, idx) => {
              doc.text(`${idx + 1}. ${example.traceId} - ${example.message}`);
            });
          }
          doc.moveDown();
        });
      }

      doc.end();

      writeStream.on('finish', () => {
        resolve({
          report,
          filePath,
          format: 'pdf'
        });
      });

      writeStream.on('error', reject);
    });
  }

  static async listReports(createdBy, limit = 50) {
    const query = createdBy ? { createdBy } : {};
    return await AnalysisReport.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  static async getReport(reportId) {
    return await AnalysisReport.findOne({ reportId });
  }
}

module.exports = ReportService;
