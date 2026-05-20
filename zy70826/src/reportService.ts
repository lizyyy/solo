import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'json2csv';
import {
  ReconciliationReport,
  ReconciliationRecord,
  ReconciliationSummary,
  Discrepancy,
  generateId,
  getAllDiscrepancyTypes,
  getAllDiscrepancyDescriptions
} from './types';

export class ReportService {
  generateReport(
    batchCode: string,
    records: ReconciliationRecord[],
    summary: ReconciliationSummary,
    discrepancies: Discrepancy[]
  ): ReconciliationReport {
    return {
      reportId: generateId(),
      generatedAt: new Date().toISOString(),
      batchCode,
      summary,
      records,
      discrepancies
    };
  }

  exportToJSON(report: ReconciliationReport, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  }

  exportRecordsToCSV(records: ReconciliationRecord[], outputPath: string): void {
    const fields = [
      { label: '批次代码', value: 'batchCode' },
      { label: '达人姓名', value: 'influencerName' },
      { label: '样品名称', value: 'sampleName' },
      { label: '样品编码', value: 'sampleCode' },
      { label: '原始状态', value: 'originalStatus' },
      { label: '当前状态', value: 'currentStatus' },
      { label: '差异数量', value: (record: ReconciliationRecord) => record.discrepancies.length },
      { label: '差异类型', value: (record: ReconciliationRecord) => getAllDiscrepancyTypes(record) },
      { label: '差异描述', value: (record: ReconciliationRecord) => getAllDiscrepancyDescriptions(record) },
      { label: '差异来源', value: (record: ReconciliationRecord) => record.discrepancies.map(d => d.source).join(' | ') },
      { label: '扣款金额', value: 'deductionAmount' },
      { label: '复核状态', value: 'reviewStatus' },
      { label: '复核人', value: 'reviewer' },
      { label: '复核备注', value: 'reviewNotes' },
      { label: '是否已修改', value: 'isModified' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records);

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, '\uFEFF' + csv);
  }

  exportSummaryToCSV(summary: ReconciliationSummary, outputPath: string): void {
    const data = [{
      '总记录数': summary.totalShipments,
      '按时归还': summary.returnedOnTime,
      '超期未还': summary.overdue,
      '破损': summary.damaged,
      '丢失': summary.lost,
      '总扣款金额': summary.totalDeduction,
      '待复核': summary.pendingReview,
      '已复核': summary.reviewed
    }];

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, '\uFEFF' + csv);
  }

  exportDiscrepanciesToCSV(discrepancies: Discrepancy[], outputPath: string): void {
    const fields = [
      { label: '差异ID', value: 'id' },
      { label: '寄送单ID', value: 'shipmentId' },
      { label: '差异类型', value: 'type' },
      { label: '描述', value: 'description' },
      { label: '涉及金额', value: 'amount' },
      { label: '来源', value: 'source' },
      { label: '是否已解决', value: 'isResolved' },
      { label: '解决方案', value: 'resolution' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(discrepancies);

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, '\uFEFF' + csv);
  }

  exportFullReport(
    report: ReconciliationReport,
    outputDir: string
  ): {
    jsonPath: string;
    recordsCsvPath: string;
    summaryCsvPath: string;
    discrepanciesCsvPath: string;
  } {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `reconciliation-${report.batchCode}-${timestamp}`;

    const jsonPath = path.join(outputDir, `${baseName}.json`);
    const recordsCsvPath = path.join(outputDir, `${baseName}-records.csv`);
    const summaryCsvPath = path.join(outputDir, `${baseName}-summary.csv`);
    const discrepanciesCsvPath = path.join(outputDir, `${baseName}-discrepancies.csv`);

    this.exportToJSON(report, jsonPath);
    this.exportRecordsToCSV(report.records, recordsCsvPath);
    this.exportSummaryToCSV(report.summary, summaryCsvPath);
    this.exportDiscrepanciesToCSV(report.discrepancies, discrepanciesCsvPath);

    return { jsonPath, recordsCsvPath, summaryCsvPath, discrepanciesCsvPath };
  }

  generateTextSummary(report: ReconciliationReport): string {
    const { summary, discrepancies } = report;
    
    const resolvedCount = discrepancies.filter(d => d.isResolved).length;
    const unresolvedCount = discrepancies.filter(d => !d.isResolved).length;

    return `
========================================
        MCN样品对账报告
========================================
报告编号: ${report.reportId}
生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}
批次代码: ${report.batchCode}

----------------------------------------
            汇总统计
----------------------------------------
总记录数: ${summary.totalShipments}
按时归还: ${summary.returnedOnTime}
超期未还: ${summary.overdue}
破损: ${summary.damaged}
丢失: ${summary.lost}
总扣款金额: ¥${summary.totalDeduction.toFixed(2)}

待复核: ${summary.pendingReview}
已复核: ${summary.reviewed}

----------------------------------------
            差异统计
----------------------------------------
总差异数: ${discrepancies.length}
已解决: ${resolvedCount}
待解决: ${unresolvedCount}

----------------------------------------
        差异详情
----------------------------------------
${discrepancies.map(d => `
[${d.type}]
描述: ${d.description}
金额: ¥${d.amount.toFixed(2)}
来源: ${d.source}
状态: ${d.isResolved ? '已解决' : '待处理'}
${d.resolution ? `解决方案: ${d.resolution}` : ''}
`).join('')}

========================================
            报告结束
========================================
    `.trim();
  }

  exportTextReport(report: ReconciliationReport, outputPath: string): void {
    const text = this.generateTextSummary(report);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, text);
  }
}
