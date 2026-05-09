const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const { formatDate, formatDuration } = require('./utils');
const { ANOMALY_NAMES } = require('./constants');

class Exporter {
  constructor(database) {
    this.db = database;
  }
  
  ensureExportDir(outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  exportToJSON(data, outputPath) {
    this.ensureExportDir(outputPath);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    return outputPath;
  }
  
  async exportRunToCSV(runId, outputPath) {
    this.ensureExportDir(outputPath);
    
    const run = this.db.getRun(runId);
    const validations = this.db.getRunValidations(runId);
    
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'trackingNumber', title: '运单号' },
        { id: 'result', title: '校验结果' },
        { id: 'traceCount', title: '轨迹数量' },
        { id: 'anomaliesHigh', title: '高危异常' },
        { id: 'anomaliesMedium', title: '中危异常' },
        { id: 'anomaliesLow', title: '低危异常' },
        { id: 'anomalyTypes', title: '异常类型' },
        { id: 'durationMs', title: '耗时(ms)' },
        { id: 'validatedAt', title: '校验时间' }
      ]
    });
    
    const records = validations.map(v => {
      const anomalies = this.db.getValidationAnomalies(v.id);
      const types = [...new Set(anomalies.map(a => ANOMALY_NAMES[a.type] || a.type))].join('; ');
      
      return {
        trackingNumber: v.tracking_number,
        result: this.translateResult(v.result),
        traceCount: v.trace_count,
        anomaliesHigh: v.anomalies_high,
        anomaliesMedium: v.anomalies_medium,
        anomaliesLow: v.anomalies_low,
        anomalyTypes: types,
        durationMs: v.duration_ms,
        validatedAt: v.completed_at || v.started_at
      };
    });
    
    await csvWriter.writeRecords(records);
    return outputPath;
  }
  
  async exportPackageAnomaliesToCSV(trackingNumber, outputPath) {
    this.ensureExportDir(outputPath);
    
    const validations = this.db.getPackageValidations(trackingNumber, 1);
    if (validations.length === 0) {
      throw new Error(`No validations found for package: ${trackingNumber}`);
    }
    
    const anomalies = this.db.getValidationAnomalies(validations[0].id);
    
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'trackingNumber', title: '运单号' },
        { id: 'type', title: '异常类型' },
        { id: 'typeName', title: '异常名称' },
        { id: 'severity', title: '严重程度' },
        { id: 'confidence', title: '置信度' },
        { id: 'actionPriority', title: '优先级' },
        { id: 'message', title: '异常描述' },
        { id: 'causes', title: '可能原因' },
        { id: 'evidence', title: '证据' },
        { id: 'suggestions', title: '处理建议' }
      ]
    });
    
    const records = anomalies.map(a => ({
      trackingNumber,
      type: a.type,
      typeName: a.name,
      severity: this.translateSeverity(a.severity),
      confidence: this.translateConfidence(a.confidence),
      actionPriority: a.action_priority,
      message: a.message,
      causes: a.causes ? JSON.parse(a.causes).join('; ') : '',
      evidence: a.evidence ? JSON.parse(a.evidence).join('; ') : '',
      suggestions: a.suggestions ? JSON.parse(a.suggestions).join('; ') : ''
    }));
    
    await csvWriter.writeRecords(records);
    return outputPath;
  }
  
  exportReport(analysis, outputPath, options = {}) {
    this.ensureExportDir(outputPath);
    
    const report = {
      generatedAt: formatDate(new Date()),
      summary: {
        result: this.translateResult(analysis.result),
        traceCount: analysis.traceCount,
        anomalies: {
          total: analysis.summary?.total || 0,
          high: analysis.summary?.high || 0,
          medium: analysis.summary?.medium || 0,
          low: analysis.summary?.low || 0
        },
        durationMs: analysis.durationMs,
        durationFormatted: formatDuration(analysis.durationMs)
      },
      traces: analysis.sortedTraces?.map((t, i) => ({
        index: i + 1,
        status: t.status,
        time: formatDate(t.time || t.timestamp),
        location: t.location || t.city,
        message: t.message || t.description
      })) || [],
      anomalies: (analysis.anomalies || []).map(a => ({
        type: a.type,
        name: a.name,
        severity: this.translateSeverity(a.severity),
        confidence: this.translateConfidence(a.confidence),
        actionPriority: a.actionPriority,
        message: a.message,
        causes: a.causes,
        evidence: a.evidence,
        suggestions: a.suggestions
      })),
      preparedIssues: analysis.prepared?.issues || []
    };
    
    if (options.format === 'json' || outputPath.endsWith('.json')) {
      this.exportToJSON(report, outputPath);
    } else if (options.format === 'md' || outputPath.endsWith('.md')) {
      this.exportToMarkdown(report, outputPath);
    } else {
      this.exportToJSON(report, outputPath + '.json');
    }
    
    return outputPath;
  }
  
  exportToMarkdown(report, outputPath) {
    const md = this.generateMarkdownReport(report);
    this.ensureExportDir(outputPath);
    fs.writeFileSync(outputPath, md, 'utf8');
    return outputPath;
  }
  
  generateMarkdownReport(report) {
    const s = report.summary;
    const lines = [];
    
    lines.push(`# 物流轨迹异常分析报告`);
    lines.push('');
    lines.push(`- **生成时间**: ${report.generatedAt}`);
    lines.push(`- **校验结果**: ${s.result}`);
    lines.push(`- **轨迹数量**: ${s.traceCount}`);
    lines.push(`- **分析耗时**: ${s.durationFormatted}`);
    lines.push('');
    
    lines.push(`## 异常统计`);
    lines.push('');
    lines.push(`| 严重程度 | 数量 |`);
    lines.push(`|----------|------|`);
    lines.push(`| 高危 | ${s.anomalies.high} |`);
    lines.push(`| 中危 | ${s.anomalies.medium} |`);
    lines.push(`| 低危 | ${s.anomalies.low} |`);
    lines.push(`| **总计** | **${s.anomalies.total}** |`);
    lines.push('');
    
    if (report.anomalies && report.anomalies.length > 0) {
      lines.push(`## 异常详情`);
      lines.push('');
      
      report.anomalies.forEach((a, i) => {
        lines.push(`### ${i + 1}. ${a.name} (${a.actionPriority})`);
        lines.push('');
        lines.push(`- **类型**: ${a.type}`);
        lines.push(`- **严重程度**: ${a.severity}`);
        lines.push(`- **置信度**: ${a.confidence}`);
        lines.push(`- **描述**: ${a.message}`);
        lines.push('');
        
        if (a.causes && a.causes.length > 0) {
          lines.push(`**可能原因**:`);
          lines.push('');
          a.causes.forEach(c => lines.push(`- ${c}`));
          lines.push('');
        }
        
        if (a.evidence && a.evidence.length > 0) {
          lines.push(`**证据**:`);
          lines.push('');
          a.evidence.forEach(e => lines.push(`- ${e}`));
          lines.push('');
        }
        
        if (a.suggestions && a.suggestions.length > 0) {
          lines.push(`**处理建议**:`);
          lines.push('');
          a.suggestions.forEach(sug => lines.push(`- ${sug}`));
          lines.push('');
        }
      });
    }
    
    lines.push(`## 轨迹详情`);
    lines.push('');
    lines.push(`| # | 状态 | 时间 | 地点 | 描述 |`);
    lines.push(`|---|------|------|------|------|`);
    report.traces.forEach(t => {
      lines.push(`| ${t.index} | ${t.status} | ${t.time} | ${t.location || '-'} | ${t.message || '-'} |`);
    });
    
    if (report.preparedIssues && report.preparedIssues.length > 0) {
      lines.push('');
      lines.push(`## 预处理问题`);
      lines.push('');
      report.preparedIssues.forEach((issue, i) => {
        lines.push(`### ${i + 1}. ${issue.type}`);
        lines.push('');
        lines.push(`- **消息**: ${issue.message}`);
        if (issue.details) {
          lines.push(`- **详情**: \`${JSON.stringify(issue.details)}\``);
        }
        lines.push('');
      });
    }
    
    return lines.join('\n');
  }
  
  translateResult(result) {
    const map = {
      valid: '正常',
      warning: '警告',
      error: '异常'
    };
    return map[result] || result;
  }
  
  translateSeverity(severity) {
    const map = {
      high: '高危',
      medium: '中危',
      low: '低危'
    };
    return map[severity] || severity;
  }
  
  translateConfidence(confidence) {
    const map = {
      high: '高',
      medium: '中',
      low: '低'
    };
    return map[confidence] || confidence;
  }
  
  exportPackageToMarkdown(report, outputPath) {
    const md = this.generatePackageMarkdownReport(report);
    this.ensureExportDir(outputPath);
    fs.writeFileSync(outputPath, md, 'utf8');
    return outputPath;
  }
  
  generatePackageMarkdownReport(report) {
    const lines = [];
    const pkg = report.package;
    const validation = report.validation;
    const anomalies = report.anomalies || [];
    const traces = report.traces || [];
    
    lines.push(`# 包裹物流轨迹异常分析报告`);
    lines.push('');
    lines.push(`## 基本信息`);
    lines.push('');
    lines.push(`| 项目 | 内容 |`);
    lines.push(`|------|------|`);
    lines.push(`| 运单号 | ${pkg.tracking_number} |`);
    lines.push(`| 来源 | ${pkg.source || '-'} |`);
    lines.push(`| 承运商 | ${pkg.carrier || '-'} |`);
    lines.push(`| 校验结果 | **${this.translateResult(validation.result)}** |`);
    lines.push(`| 轨迹数量 | ${validation.trace_count} |`);
    lines.push(`| 异常总数 | ${validation.anomalies_total} |`);
    lines.push(`| 分析耗时 | ${validation.duration_ms}ms |`);
    lines.push(`| 分析时间 | ${validation.started_at} |`);
    lines.push('');
    
    lines.push(`## 异常统计`);
    lines.push('');
    lines.push(`| 严重程度 | 数量 |`);
    lines.push(`|----------|------|`);
    lines.push(`| 高危 | ${validation.anomalies_high} |`);
    lines.push(`| 中危 | ${validation.anomalies_medium} |`);
    lines.push(`| 低危 | ${validation.anomalies_low} |`);
    lines.push(`| **总计** | **${validation.anomalies_total}** |`);
    lines.push('');
    
    if (anomalies.length > 0) {
      lines.push(`## 异常详情`);
      lines.push('');
      
      anomalies.forEach((a, i) => {
        const priorityMap = { high: 'P0', medium: 'P1', low: 'P2' };
        const priority = priorityMap[a.severity] || a.severity;
        
        const causes = typeof a.causes === 'string' ? JSON.parse(a.causes) : (a.causes || []);
        const evidence = typeof a.evidence === 'string' ? JSON.parse(a.evidence) : (a.evidence || []);
        const suggestions = typeof a.suggestions === 'string' ? JSON.parse(a.suggestions) : (a.suggestions || []);
        
        lines.push(`### ${i + 1}. [${priority}] ${(a.name || a.type).replace(/_/g, ' ')}`);
        lines.push('');
        lines.push(`- **严重程度**: ${this.translateSeverity(a.severity)}`);
        lines.push(`- **置信度**: ${this.translateConfidence(a.confidence || 'medium')}`);
        lines.push(`- **描述**: ${a.message}`);
        lines.push('');
        
        if (causes && causes.length > 0) {
          lines.push(`**可能原因**:`);
          lines.push('');
          causes.forEach(c => lines.push(`- ${c}`));
          lines.push('');
        }
        
        if (evidence && evidence.length > 0) {
          lines.push(`**证据**:`);
          lines.push('');
          evidence.forEach(e => lines.push(`- ${e}`));
          lines.push('');
        }
        
        if (suggestions && suggestions.length > 0) {
          lines.push(`**处理建议**:`);
          lines.push('');
          suggestions.forEach(sug => lines.push(`- ${sug}`));
          lines.push('');
        }
      });
    }
    
    if (traces.length > 0) {
      lines.push(`## 轨迹详情`);
      lines.push('');
      lines.push(`| # | 状态 | 时间 | 地点 | 描述 |`);
      lines.push(`|---|------|------|------|------|`);
      traces.forEach((t, index) => {
        lines.push(`| ${index + 1} | ${t.status} | ${t.time} | ${t.location || t.city || '-'} | ${t.message || '-'} |`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  exportRunToMarkdown(report, outputPath) {
    const md = this.generateRunMarkdownReport(report);
    this.ensureExportDir(outputPath);
    fs.writeFileSync(outputPath, md, 'utf8');
    return outputPath;
  }
  
  generateRunMarkdownReport(report) {
    const lines = [];
    const run = report.run;
    const validations = report.validations || [];
    
    const total = validations.length;
    const valid = validations.filter(v => v.result === 'valid').length;
    const warning = validations.filter(v => v.result === 'warning').length;
    const error = validations.filter(v => v.result === 'error').length;
    const totalAnomalies = validations.reduce((sum, v) => sum + (v.anomalies_total || 0), 0);
    const highAnomalies = validations.reduce((sum, v) => sum + (v.anomalies_high || 0), 0);
    const mediumAnomalies = validations.reduce((sum, v) => sum + (v.anomalies_medium || 0), 0);
    const lowAnomalies = validations.reduce((sum, v) => sum + (v.anomalies_low || 0), 0);
    
    lines.push(`# 批量校验分析报告`);
    lines.push('');
    lines.push(`## 批次信息`);
    lines.push('');
    lines.push(`| 项目 | 内容 |`);
    lines.push(`|------|------|`);
    lines.push(`| 批次名称 | ${run.name} |`);
    lines.push(`| 批次 ID | ${run.id} |`);
    lines.push(`| 开始时间 | ${run.started_at} |`);
    lines.push(`| 结束时间 | ${run.completed_at || '-'} |`);
    lines.push('');
    
    lines.push(`## 校验统计`);
    lines.push('');
    lines.push(`| 指标 | 数量 |`);
    lines.push(`|------|------|`);
    lines.push(`| 总包裹数 | ${total} |`);
    lines.push(`| 正常 | ${valid} |`);
    lines.push(`| 警告 | ${warning} |`);
    lines.push(`| 异常 | ${error} |`);
    lines.push(`| 异常总数 | ${totalAnomalies} |`);
    lines.push('');
    
    lines.push(`## 异常统计`);
    lines.push('');
    lines.push(`| 严重程度 | 数量 |`);
    lines.push(`|----------|------|`);
    lines.push(`| 高危 | ${highAnomalies} |`);
    lines.push(`| 中危 | ${mediumAnomalies} |`);
    lines.push(`| 低危 | ${lowAnomalies} |`);
    lines.push('');
    
    if (validations.length > 0) {
      lines.push(`## 包裹详情`);
      lines.push('');
      lines.push(`| # | 运单号 | 结果 | 轨迹数 | 异常数 |`);
      lines.push(`|---|--------|------|--------|--------|`);
      
      validations.forEach((v, index) => {
        const resultIcon = v.result === 'valid' ? '✓' : v.result === 'warning' ? '⚠' : '✗';
        const anomaliesStr = v.anomalies_total > 0 
          ? `高危${v.anomalies_high}/中危${v.anomalies_medium}/低危${v.anomalies_low}`
          : '无';
        lines.push(`| ${index + 1} | ${v.tracking_number} | ${resultIcon} ${this.translateResult(v.result)} | ${v.trace_count} | ${anomaliesStr} |`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }
}

module.exports = Exporter;
