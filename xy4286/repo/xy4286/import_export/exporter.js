const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment');
const repositories = require('../repositories');
const models = require('../models');
const { AUDIT_ACTIONS, ENTITY_TYPES } = require('../models/auditEvent');

class Exporter {
  constructor() {
    this.batchRepo = new repositories.BatchRepository();
    this.riskEventRepo = new repositories.RiskEventRepository();
    this.handoverFormRepo = new repositories.HandoverFormRepository();
    this.temperatureLogRepo = new repositories.TemperatureLogRepository();
    this.auditEventRepo = new repositories.AuditEventRepository();
  }

  exportToJSON(batchId = null) {
    const data = this._collectExportData(batchId);
    
    return {
      success: true,
      data,
      format: 'json'
    };
  }

  async exportToCSV(batchId = null, outputPath = null) {
    const data = this._collectExportData(batchId);
    
    const summaryCsv = await this._writeSummaryCSV(data.summary, outputPath ? path.join(outputPath, 'summary.csv') : null);
    const risksCsv = await this._writeRisksCSV(data.risks, outputPath ? path.join(outputPath, 'risks.csv') : null);
    const temperatureCsv = await this._writeTemperatureCSV(data.temperatureLogs, outputPath ? path.join(outputPath, 'temperature.csv') : null);
    const handoverCsv = await this._writeHandoverCSV(data.handoverForms, outputPath ? path.join(outputPath, 'handover.csv') : null);

    return {
      success: true,
      files: {
        summary: summaryCsv,
        risks: risksCsv,
        temperature: temperatureCsv,
        handover: handoverCsv
      },
      format: 'csv'
    };
  }

  exportToMarkdown(batchId = null) {
    const data = this._collectExportData(batchId);
    const markdown = this._generateMarkdown(data);
    
    return {
      success: true,
      content: markdown,
      format: 'markdown'
    };
  }

  _collectExportData(batchId = null) {
    const batches = batchId 
      ? [this.batchRepo.findById(batchId)].filter(b => b)
      : this.batchRepo.findAll();

    const batchIds = batches.map(b => b.id);
    
    const risks = batchId 
      ? this.riskEventRepo.findByBatchId(batchId)
      : this.riskEventRepo.findAll();

    const handoverForms = batchId 
      ? this.handoverFormRepo.findByBatchId(batchId)
      : this.handoverFormRepo.findAll();

    const boxIds = batches.map(b => b.boxId).filter(id => id);
    const temperatureLogs = [];
    boxIds.forEach(boxId => {
      temperatureLogs.push(...this.temperatureLogRepo.findByBoxId(boxId));
    });

    return {
      summary: this._generateSummary(batches, risks),
      batches: batches.map(b => b.toJSON()),
      risks: risks.map(r => r.toJSON()),
      handoverForms: handoverForms.map(h => h.toJSON()),
      temperatureLogs: temperatureLogs.map(t => t.toJSON()),
      generatedAt: moment().toISOString()
    };
  }

  _generateSummary(batches, risks) {
    const totalBatches = batches.length;
    const batchesWithRisk = batches.filter(b => b.hasAnyRisk()).length;
    const openRisks = risks.filter(r => r.status === 'open').length;
    const resolvedRisks = risks.filter(r => r.status === 'resolved').length;
    
    const temperatureViolations = risks.filter(r => r.type === 'temperature_violation').length;
    const delays = risks.filter(r => r.type === 'delay').length;
    const missingSignatures = risks.filter(r => r.type === 'signature_missing').length;
    const chainBreaks = risks.filter(r => r.type === 'chain_break').length;

    return {
      totalBatches,
      batchesWithRisk,
      batchesWithoutRisk: totalBatches - batchesWithRisk,
      totalRisks: risks.length,
      openRisks,
      resolvedRisks,
      temperatureViolations,
      delays,
      missingSignatures,
      chainBreaks,
      generatedAt: moment().toISOString()
    };
  }

  _generateMarkdown(data) {
    const { summary, batches, risks, handoverForms, temperatureLogs } = data;
    
    let md = `# 疫苗运输监控报告\n\n`;
    md += `**生成时间**: ${moment(data.generatedAt).format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    
    md += `## 概览\n\n`;
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 总批次 | ${summary.totalBatches} |\n`;
    md += `| 有风险批次 | ${summary.batchesWithRisk} |\n`;
    md += `| 无风险批次 | ${summary.batchesWithoutRisk} |\n`;
    md += `| 总风险事件 | ${summary.totalRisks} |\n`;
    md += `| 待处理风险 | ${summary.openRisks} |\n`;
    md += `| 已解决风险 | ${summary.resolvedRisks} |\n\n`;
    
    md += `### 风险类型分布\n\n`;
    md += `| 类型 | 数量 |\n`;
    md += `|------|------|\n`;
    md += `| 温度异常 | ${summary.temperatureViolations} |\n`;
    md += `| 延误 | ${summary.delays} |\n`;
    md += `| 签名缺失 | ${summary.missingSignatures} |\n`;
    md += `| 链路中断 | ${summary.chainBreaks} |\n\n`;

    if (risks.length > 0) {
      md += `## 风险事件详情\n\n`;
      risks.forEach((risk, index) => {
        md += `### 风险 #${index + 1}\n\n`;
        md += `- **类型**: ${risk.type}\n`;
        md += `- **严重程度**: ${risk.severity}\n`;
        md += `- **状态**: ${risk.status}\n`;
        md += `- **标题**: ${risk.title}\n`;
        md += `- **描述**: ${risk.description}\n`;
        md += `- **发生时间**: ${moment(risk.occurredAt).format('YYYY-MM-DD HH:mm:ss')}\n`;
        if (risk.resolvedAt) {
          md += `- **解决时间**: ${moment(risk.resolvedAt).format('YYYY-MM-DD HH:mm:ss')}\n`;
        }
        md += `\n`;
      });
    }

    if (handoverForms.length > 0) {
      md += `## 交接单详情\n\n`;
      handoverForms.forEach((form, index) => {
        md += `### 交接单 #${index + 1} - ${form.formNumber}\n\n`;
        md += `- **状态**: ${form.currentState}\n`;
        md += `- **签名完整**: ${form.hasCompleteSignatures ? '是' : '否'}\n`;
        if (form.missingSignatures.length > 0) {
          md += `- **缺失签名**: ${form.missingSignatures.join(', ')}\n`;
        }
        if (form.handoffTime) {
          md += `- **交接时间**: ${moment(form.handoffTime).format('YYYY-MM-DD HH:mm:ss')}\n`;
        }
        md += `\n`;
      });
    }

    md += `---\n\n`;
    md += `*报告由疫苗运输监控系统自动生成*\n`;

    return md;
  }

  async _writeSummaryCSV(summary, outputPath) {
    const records = [
      { metric: '总批次', value: summary.totalBatches },
      { metric: '有风险批次', value: summary.batchesWithRisk },
      { metric: '无风险批次', value: summary.batchesWithoutRisk },
      { metric: '总风险事件', value: summary.totalRisks },
      { metric: '待处理风险', value: summary.openRisks },
      { metric: '已解决风险', value: summary.resolvedRisks },
      { metric: '温度异常', value: summary.temperatureViolations },
      { metric: '延误', value: summary.delays },
      { metric: '签名缺失', value: summary.missingSignatures },
      { metric: '链路中断', value: summary.chainBreaks }
    ];

    if (outputPath) {
      const csvWriter = createCsvWriter({
        path: outputPath,
        header: [
          { id: 'metric', title: '指标' },
          { id: 'value', title: '数值' }
        ]
      });
      await csvWriter.writeRecords(records);
      return outputPath;
    }
    
    return records;
  }

  async _writeRisksCSV(risks, outputPath) {
    const records = risks.map((risk, index) => ({
      id: index + 1,
      type: risk.type,
      severity: risk.severity,
      status: risk.status,
      title: risk.title,
      description: risk.description,
      occurredAt: risk.occurredAt,
      resolvedAt: risk.resolvedAt || ''
    }));

    if (outputPath) {
      const csvWriter = createCsvWriter({
        path: outputPath,
        header: [
          { id: 'id', title: '序号' },
          { id: 'type', title: '类型' },
          { id: 'severity', title: '严重程度' },
          { id: 'status', title: '状态' },
          { id: 'title', title: '标题' },
          { id: 'description', title: '描述' },
          { id: 'occurredAt', title: '发生时间' },
          { id: 'resolvedAt', title: '解决时间' }
        ]
      });
      await csvWriter.writeRecords(records);
      return outputPath;
    }
    
    return records;
  }

  async _writeTemperatureCSV(logs, outputPath) {
    const records = logs.map((log, index) => ({
      id: index + 1,
      boxId: log.boxId,
      timestamp: log.timestamp,
      temperature: log.temperature,
      unit: log.unit,
      source: log.source
    }));

    if (outputPath) {
      const csvWriter = createCsvWriter({
        path: outputPath,
        header: [
          { id: 'id', title: '序号' },
          { id: 'boxId', title: '箱体ID' },
          { id: 'timestamp', title: '时间戳' },
          { id: 'temperature', title: '温度' },
          { id: 'unit', title: '单位' },
          { id: 'source', title: '来源' }
        ]
      });
      await csvWriter.writeRecords(records);
      return outputPath;
    }
    
    return records;
  }

  async _writeHandoverCSV(forms, outputPath) {
    const records = forms.map((form, index) => ({
      id: index + 1,
      formNumber: form.formNumber,
      batchId: form.batchId,
      state: form.currentState,
      hasCompleteSignatures: form.hasCompleteSignatures ? '是' : '否',
      missingSignatures: form.missingSignatures.join(','),
      handoffTime: form.handoffTime || '',
      actualReceiveTime: form.actualReceiveTime || ''
    }));

    if (outputPath) {
      const csvWriter = createCsvWriter({
        path: outputPath,
        header: [
          { id: 'id', title: '序号' },
          { id: 'formNumber', title: '交接单号' },
          { id: 'batchId', title: '批次ID' },
          { id: 'state', title: '状态' },
          { id: 'hasCompleteSignatures', title: '签名完整' },
          { id: 'missingSignatures', title: '缺失签名' },
          { id: 'handoffTime', title: '交接时间' },
          { id: 'actualReceiveTime', title: '实际接收时间' }
        ]
      });
      await csvWriter.writeRecords(records);
      return outputPath;
    }
    
    return records;
  }
}

module.exports = Exporter;
