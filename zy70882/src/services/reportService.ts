import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import moment from 'moment';
import { BillingRecord, BillingSummary } from '../types';
import { dataStore } from '../store/dataStore';

export class ReportService {
  async generateExcelReport(periodStart: Date, periodEnd: Date, includeDetails: boolean = true): Promise<Buffer> {
    const records = dataStore.getBillingRecordsByPeriod(periodStart, periodEnd);
    const summary = dataStore.getBillingSummary(periodStart, periodEnd);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '冷库园区对账系统';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('汇总表');
    this.populateSummarySheet(summarySheet, summary, periodStart, periodEnd);

    const recordsSheet = workbook.addWorksheet('账单明细');
    this.populateRecordsSheet(recordsSheet, records);

    if (includeDetails) {
      const anomaliesSheet = workbook.addWorksheet('异常说明');
      this.populateAnomaliesSheet(anomaliesSheet, records);

      const calculationsSheet = workbook.addWorksheet('计算明细');
      this.populateCalculationsSheet(calculationsSheet, records);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private populateSummarySheet(sheet: ExcelJS.Worksheet, summary: BillingSummary, periodStart: Date, periodEnd: Date) {
    const titleRow = sheet.addRow(['冷库园区账单汇总表']);
    titleRow.font = { bold: true, size: 16 };
    titleRow.height = 30;

    sheet.addRow(['计费周期', `${moment(periodStart).format('YYYY-MM-DD')} 至 ${moment(periodEnd).format('YYYY-MM-DD')}`]);
    sheet.addRow([]);

    sheet.addRow(['统计项', '数值']);
    sheet.addRow(['租户总数', summary.totalTenants]);
    sheet.addRow(['总用电量 (kWh)', summary.totalConsumption.toFixed(2)]);
    sheet.addRow(['总电费 (元)', summary.totalElectricityCost.toFixed(2)]);
    sheet.addRow(['基础租金 (元)', summary.totalBaseRent.toFixed(2)]);
    sheet.addRow(['加班附加费 (元)', summary.totalOvertimeSurcharge.toFixed(2)]);
    sheet.addRow(['总计 (元)', summary.grandTotal.toFixed(2)]);
    sheet.addRow([]);

    sheet.addRow(['审批状态统计']);
    sheet.addRow(['待审批', summary.recordsByStatus.pending]);
    sheet.addRow(['已通过', summary.recordsByStatus.approved]);
    sheet.addRow(['已驳回', summary.recordsByStatus.rejected]);
    sheet.addRow(['需补充材料', summary.recordsByStatus.needs_more_info]);
    sheet.addRow([]);

    sheet.addRow(['异常记录数', summary.anomalyCount]);

    const headerRow = sheet.getRow(4);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    sheet.columns.forEach(column => {
      column.width = 25;
    });
  }

  private populateRecordsSheet(sheet: ExcelJS.Worksheet, records: BillingRecord[]) {
    const headers = [
      '租户ID', '租户名称', '温区ID', '温区名称',
      '基础用电量(kWh)', '加班用电量(kWh)', '总用电量(kWh)',
      '应用倍率', '电价(元/kWh)',
      '电费(元)', '基础租金(元)', '加班附加费(元)', '总计(元)',
      '异常数', '审批状态'
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    records.forEach(record => {
      sheet.addRow([
        record.tenantId,
        record.tenantName,
        record.zoneId,
        record.zoneName,
        record.baseConsumption.toFixed(2),
        record.overtimeConsumption.toFixed(2),
        record.totalConsumption.toFixed(2),
        record.appliedMultiplier.toFixed(2),
        record.ratePerKwh.toFixed(4),
        record.electricityCost.toFixed(2),
        record.baseRent.toFixed(2),
        record.overtimeSurcharge.toFixed(2),
        record.totalAmount.toFixed(2),
        record.anomalies.length,
        this.getStatusText(record.reviewStatus)
      ]);
    });

    sheet.columns.forEach(column => {
      column.width = 18;
    });
  }

  private populateAnomaliesSheet(sheet: ExcelJS.Worksheet, records: BillingRecord[]) {
    const headers = [
      '租户ID', '租户名称', '温区名称',
      '异常类型', '严重程度', '时间',
      '描述', '解释说明', '影响金额(元)', '是否已解决'
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    records.forEach(record => {
      record.anomalies.forEach(anomaly => {
        sheet.addRow([
          record.tenantId,
          record.tenantName,
          record.zoneName,
          this.getAnomalyTypeText(anomaly.type),
          this.getSeverityText(anomaly.severity),
          moment(anomaly.timestamp).format('YYYY-MM-DD HH:mm'),
          anomaly.description,
          anomaly.explanation,
          anomaly.affectedAmount.toFixed(2),
          anomaly.resolved ? '是' : '否'
        ]);
      });
    });

    sheet.columns.forEach(column => {
      column.width = 20;
    });
  }

  private populateCalculationsSheet(sheet: ExcelJS.Worksheet, records: BillingRecord[]) {
    const headers = [
      '租户ID', '租户名称', '温区名称',
      '步骤', '描述', '公式', '结果'
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    records.forEach(record => {
      record.calculationDetails.forEach(detail => {
        sheet.addRow([
          record.tenantId,
          record.tenantName,
          record.zoneName,
          detail.step,
          detail.description,
          detail.formula,
          detail.result.toFixed(2)
        ]);
      });
    });

    sheet.columns.forEach(column => {
      column.width = 25;
    });
  }

  async generatePDFReport(periodStart: Date, periodEnd: Date, includeDetails: boolean = true): Promise<Buffer> {
    const records = dataStore.getBillingRecordsByPeriod(periodStart, periodEnd);
    const summary = dataStore.getBillingSummary(periodStart, periodEnd);

    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      doc.fontSize(20).text('冷库园区账单报告', { align: 'center' });
      doc.moveDown();

      doc.fontSize(12).text(`计费周期: ${moment(periodStart).format('YYYY-MM-DD')} 至 ${moment(periodEnd).format('YYYY-MM-DD')}`);
      doc.moveDown();

      doc.fontSize(14).text('汇总信息', { underline: true });
      doc.moveDown();

      const summaryData = [
        ['租户总数', summary.totalTenants.toString()],
        ['总用电量', `${summary.totalConsumption.toFixed(2)} kWh`],
        ['总电费', `${summary.totalElectricityCost.toFixed(2)} 元`],
        ['基础租金', `${summary.totalBaseRent.toFixed(2)} 元`],
        ['加班附加费', `${summary.totalOvertimeSurcharge.toFixed(2)} 元`],
        ['总计', `${summary.grandTotal.toFixed(2)} 元`],
      ];

      summaryData.forEach(([label, value]) => {
        doc.text(`${label}: ${value}`);
      });

      doc.moveDown();
      doc.text('审批状态:');
      doc.text(`  待审批: ${summary.recordsByStatus.pending}, 已通过: ${summary.recordsByStatus.approved}, 已驳回: ${summary.recordsByStatus.rejected}, 需补充材料: ${summary.recordsByStatus.needs_more_info}`);
      doc.text(`异常记录数: ${summary.anomalyCount}`);

      doc.addPage();
      doc.fontSize(14).text('账单明细', { underline: true });
      doc.moveDown();

      records.forEach((record, index) => {
        if (index > 0) doc.moveDown();

        doc.fontSize(12).text(`租户: ${record.tenantName} (${record.tenantId}) - 温区: ${record.zoneName}`);
        doc.text(`  用电量: 基础 ${record.baseConsumption.toFixed(2)} kWh + 加班 ${record.overtimeConsumption.toFixed(2)} kWh = ${record.totalConsumption.toFixed(2)} kWh`);
        doc.text(`  费用: 电费 ${record.electricityCost.toFixed(2)} 元 + 租金 ${record.baseRent.toFixed(2)} 元 + 加班附加费 ${record.overtimeSurcharge.toFixed(2)} 元 = ${record.totalAmount.toFixed(2)} 元`);
        doc.text(`  状态: ${this.getStatusText(record.reviewStatus)}`);

        if (includeDetails && record.anomalies.length > 0) {
          doc.text(`  异常 (${record.anomalies.length} 项):`);
          record.anomalies.forEach(anomaly => {
            doc.text(`    - [${this.getSeverityText(anomaly.severity)}] ${anomaly.description}`);
            doc.text(`      ${anomaly.explanation}`);
            doc.text(`      影响金额: ${anomaly.affectedAmount.toFixed(2)} 元 ${anomaly.resolved ? '(已解决)' : '(待处理)'}`);
          });
        }
      });

      if (includeDetails) {
        doc.addPage();
        doc.fontSize(14).text('计算明细示例', { underline: true });
        doc.moveDown();

        if (records.length > 0) {
          const sampleRecord = records[0];
          doc.text(`租户: ${sampleRecord.tenantName} - ${sampleRecord.zoneName}`);
          doc.moveDown();

          sampleRecord.calculationDetails.forEach(detail => {
            doc.text(`步骤 ${detail.step}: ${detail.description}`);
            doc.text(`  公式: ${detail.formula}`);
            doc.text(`  结果: ${detail.result.toFixed(2)}`);
            doc.moveDown(0.5);
          });
        }
      }

      doc.end();
    });
  }

  generateRecordDetailsHTML(record: BillingRecord): string {
    const anomaliesHTML = record.anomalies.length > 0
      ? `<div class="anomalies">
           <h3>异常记录 (${record.anomalies.length})</h3>
           ${record.anomalies.map(a => `
             <div class="anomaly ${a.severity}">
               <div class="anomaly-header">
                 <span class="type">${this.getAnomalyTypeText(a.type)}</span>
                 <span class="severity">${this.getSeverityText(a.severity)}</span>
                 <span class="resolved">${a.resolved ? '✓ 已解决' : '⚠ 待处理'}</span>
               </div>
               <div class="anomaly-time">${moment(a.timestamp).format('YYYY-MM-DD HH:mm')}</div>
               <div class="anomaly-desc">${a.description}</div>
               <div class="anomaly-explain">${a.explanation}</div>
               <div class="anomaly-amount">影响金额: ¥${a.affectedAmount.toFixed(2)}</div>
             </div>
           `).join('')}
         </div>`
      : '<p class="no-anomalies">无异常记录</p>';

    const reviewNotesHTML = record.reviewNotes.length > 0
      ? `<div class="review-notes">
           <h3>复核记录 (${record.reviewNotes.length})</h3>
           ${record.reviewNotes.map(n => `
             <div class="review-note">
               <div class="note-header">
                 <span class="user">${n.userName}</span>
                 <span class="action">${this.getActionText(n.action)}</span>
                 <span class="time">${moment(n.timestamp).format('YYYY-MM-DD HH:mm')}</span>
               </div>
               <div class="note-comment">${n.comment}</div>
               ${n.changes ? `
                 <div class="note-changes">
                   修改内容:
                   <ul>
                     ${Object.entries(n.changes).map(([field, { old, new: newValue }]) => `
                       <li>${field}: ${old} → ${newValue}</li>
                     `).join('')}
                   </ul>
                 </div>
               ` : ''}
             </div>
           `).join('')}
         </div>`
      : '<p class="no-notes">暂无复核记录</p>';

    const calcStepsHTML = record.calculationDetails.map(step => `
      <div class="calc-step">
        <div class="step-number">${step.step}</div>
        <div class="step-content">
          <div class="step-desc">${step.description}</div>
          <div class="step-formula">公式: ${step.formula}</div>
          <div class="step-result">结果: ${step.result.toFixed(2)}</div>
        </div>
      </div>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>账单详情 - ${record.tenantName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-approved { background: #d4edda; color: #155724; }
    .status-rejected { background: #f8d7da; color: #721c24; }
    .status-needs_info { background: #cce5ff; color: #004085; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #444; margin-bottom: 15px; font-size: 18px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .card { background: #f8f9fa; padding: 15px; border-radius: 6px; }
    .card-label { font-size: 12px; color: #666; margin-bottom: 5px; }
    .card-value { font-size: 18px; font-weight: 600; color: #333; }
    .amount { color: #dc3545; }
    .anomalies { margin-top: 20px; }
    .anomaly { background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 15px; margin-bottom: 10px; }
    .anomaly.high { border-left: 4px solid #dc3545; }
    .anomaly.medium { border-left: 4px solid #ffc107; }
    .anomaly.low { border-left: 4px solid #17a2b8; }
    .anomaly-header { display: flex; gap: 10px; margin-bottom: 8px; }
    .anomaly .type { font-weight: 600; }
    .anomaly .severity { font-size: 12px; padding: 2px 8px; border-radius: 10px; background: #e9ecef; }
    .anomaly.high .severity { background: #f8d7da; color: #721c24; }
    .anomaly.medium .severity { background: #fff3cd; color: #856404; }
    .anomaly .resolved { margin-left: auto; font-size: 12px; color: #28a745; }
    .anomaly-time { font-size: 12px; color: #666; margin-bottom: 5px; }
    .anomaly-desc { font-weight: 500; margin-bottom: 5px; }
    .anomaly-explain { font-size: 14px; color: #555; margin-bottom: 5px; }
    .anomaly-amount { font-size: 14px; font-weight: 500; color: #dc3545; }
    .review-notes { margin-top: 20px; }
    .review-note { background: #f8f9fa; border-radius: 6px; padding: 15px; margin-bottom: 10px; }
    .note-header { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
    .note-header .user { font-weight: 600; }
    .note-header .action { font-size: 12px; padding: 2px 8px; border-radius: 10px; background: #007bff; color: white; }
    .note-header .time { font-size: 12px; color: #666; }
    .note-comment { margin-bottom: 8px; }
    .note-changes { font-size: 13px; color: #666; background: white; padding: 10px; border-radius: 4px; }
    .note-changes ul { margin-left: 20px; margin-top: 5px; }
    .calculation { margin-top: 20px; }
    .calc-step { display: flex; gap: 15px; padding: 15px; background: #f8f9fa; border-radius: 6px; margin-bottom: 10px; }
    .step-number { width: 30px; height: 30px; background: #007bff; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
    .step-desc { font-weight: 500; margin-bottom: 5px; }
    .step-formula { font-size: 13px; color: #666; font-family: monospace; margin-bottom: 3px; }
    .step-result { font-size: 14px; font-weight: 600; color: #28a745; }
    .no-anomalies, .no-notes { color: #666; font-style: italic; padding: 15px; background: #f8f9fa; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>账单详情 <span class="status-badge status-${record.reviewStatus}">${this.getStatusText(record.reviewStatus)}</span></h1>

    <div class="section">
      <h2>基本信息</h2>
      <div class="grid">
        <div class="card"><div class="card-label">租户ID</div><div class="card-value">${record.tenantId}</div></div>
        <div class="card"><div class="card-label">租户名称</div><div class="card-value">${record.tenantName}</div></div>
        <div class="card"><div class="card-label">温区</div><div class="card-value">${record.zoneName}</div></div>
        <div class="card"><div class="card-label">计费周期</div><div class="card-value">${moment(record.periodStart).format('YYYY-MM-DD')} ~ ${moment(record.periodEnd).format('YYYY-MM-DD')}</div></div>
      </div>
    </div>

    <div class="section">
      <h2>用电量</h2>
      <div class="grid">
        <div class="card"><div class="card-label">基础用电量</div><div class="card-value">${record.baseConsumption.toFixed(2)} kWh</div></div>
        <div class="card"><div class="card-label">加班用电量</div><div class="card-value">${record.overtimeConsumption.toFixed(2)} kWh</div></div>
        <div class="card"><div class="card-label">总用电量</div><div class="card-value">${record.totalConsumption.toFixed(2)} kWh</div></div>
        <div class="card"><div class="card-label">应用倍率</div><div class="card-value">${record.appliedMultiplier.toFixed(2)}x</div></div>
      </div>
    </div>

    <div class="section">
      <h2>费用明细</h2>
      <div class="grid">
        <div class="card"><div class="card-label">电费</div><div class="card-value amount">¥${record.electricityCost.toFixed(2)}</div></div>
        <div class="card"><div class="card-label">基础租金</div><div class="card-value amount">¥${record.baseRent.toFixed(2)}</div></div>
        <div class="card"><div class="card-label">加班附加费</div><div class="card-value amount">¥${record.overtimeSurcharge.toFixed(2)}</div></div>
        <div class="card"><div class="card-label">总计</div><div class="card-value amount">¥${record.totalAmount.toFixed(2)}</div></div>
      </div>
    </div>

    <div class="section">
      <h2>异常记录</h2>
      ${anomaliesHTML}
    </div>

    <div class="section">
      <h2>复核记录</h2>
      ${reviewNotesHTML}
    </div>

    <div class="section">
      <h2>计算步骤</h2>
      <div class="calculation">
        ${calcStepsHTML}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      pending: '待审批',
      approved: '已通过',
      rejected: '已驳回',
      needs_more_info: '需补充材料'
    };
    return statusMap[status] || status;
  }

  private getAnomalyTypeText(type: string): string {
    const typeMap: Record<string, string> = {
      multiplier_change: '倍率变更',
      vacant_period: '空置期',
      spike: '用电尖峰',
      contract_mismatch: '合同不符',
      overtime: '加班用电'
    };
    return typeMap[type] || type;
  }

  private getSeverityText(severity: string): string {
    const severityMap: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高'
    };
    return severityMap[severity] || severity;
  }

  private getActionText(action: string): string {
    const actionMap: Record<string, string> = {
      approve: '通过',
      reject: '驳回',
      request_info: '要求补充材料',
      modify: '修改',
      comment: '备注'
    };
    return actionMap[action] || action;
  }
}

export const reportService = new ReportService();
