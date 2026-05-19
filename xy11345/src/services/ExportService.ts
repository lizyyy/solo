import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { PrintBatch } from '../models/PrintBatch';
import { QualityOrder } from '../models/QualityOrder';
import { maskSensitiveData, logger } from '../utils/logger';
import { auditService } from './AuditService';
import { AuditAction } from '../models/AuditLog';

export class ExportService {
  private exportsDir: string;

  constructor() {
    this.exportsDir = path.join(process.cwd(), 'exports');
    this.ensureDirectoryExists(this.exportsDir);
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async exportBatchesToExcel(batches: PrintBatch[], options: {
    filename?: string;
    includeSensitive?: boolean;
    operator?: string;
    requestId?: string;
    ipAddress?: string;
  } = {}): Promise<string> {
    const filename = options.filename || `batches_${Date.now()}.xlsx`;
    const filePath = path.join(this.exportsDir, filename);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'QC System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('质检批次数据');

    worksheet.columns = [
      { header: '批次号', key: 'batchNumber', width: 20 },
      { header: '产品名称', key: 'productName', width: 25 },
      { header: '客户名称', key: 'customerName', width: 20 },
      { header: '数量', key: 'quantity', width: 10 },
      { header: '生产日期', key: 'productionDate', width: 15 },
      { header: '机台号', key: 'machineId', width: 15 },
      { header: '状态', key: 'status', width: 15 },
      { header: '是否合格', key: 'isPassed', width: 10 },
      { header: '平均DeltaE', key: 'avgDeltaE', width: 12 },
      { header: '是否返工', key: 'hasRework', width: 10 },
      { header: '返工次数', key: 'reworkCount', width: 10 },
      { header: '判定人', key: 'judgedBy', width: 15 },
      { header: '判定时间', key: 'judgedAt', width: 20 },
      { header: '复核人', key: 'reviewedBy', width: 15 },
      { header: '复核时间', key: 'reviewedAt', width: 20 },
      { header: '操作员', key: 'operator', width: 15 },
      { header: '备注', key: 'remark', width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };

    for (const batch of batches) {
      const data = options.includeSensitive ? batch : maskSensitiveData(batch);
      worksheet.addRow({
        batchNumber: data.batchNumber,
        productName: data.productName,
        customerName: data.customerName,
        quantity: data.quantity,
        productionDate: data.productionDate,
        machineId: data.machineId,
        status: data.status,
        isPassed: data.isPassed ? '是' : '否',
        avgDeltaE: data.avgDeltaE,
        hasRework: data.hasRework ? '是' : '否',
        reworkCount: data.reworkCount,
        judgedBy: data.judgedBy,
        judgedAt: data.judgedAt,
        reviewedBy: data.reviewedBy,
        reviewedAt: data.reviewedAt,
        operator: data.operator,
        remark: data.remark,
      });
    }

    if (batches.some((b) => b.labRecords?.length > 0)) {
      const labWorksheet = workbook.addWorksheet('Lab值明细');

      labWorksheet.columns = [
        { header: '批次号', key: 'batchNumber', width: 20 },
        { header: '测量点', key: 'measurePoint', width: 15 },
        { header: '测量顺序', key: 'measureOrder', width: 10 },
        { header: 'L值', key: 'L', width: 10 },
        { header: 'a值', key: 'a', width: 10 },
        { header: 'b值', key: 'b', width: 10 },
        { header: '标准L值', key: 'standardL', width: 12 },
        { header: '标准a值', key: 'standardA', width: 12 },
        { header: '标准b值', key: 'standardB', width: 12 },
        { header: 'DeltaE', key: 'deltaE', width: 10 },
        { header: '公差', key: 'tolerance', width: 10 },
        { header: '是否合格', key: 'isWithinTolerance', width: 10 },
      ];

      labWorksheet.getRow(1).font = { bold: true };

      for (const batch of batches) {
        if (batch.labRecords) {
          for (const lab of batch.labRecords) {
            labWorksheet.addRow({
              batchNumber: batch.batchNumber,
              measurePoint: lab.measurePoint,
              measureOrder: lab.measureOrder,
              L: lab.L,
              a: lab.a,
              b: lab.b,
              standardL: lab.standardL,
              standardA: lab.standardA,
              standardB: lab.standardB,
              deltaE: lab.deltaE,
              tolerance: lab.tolerance,
              isWithinTolerance: lab.isWithinTolerance ? '是' : '否',
            });
          }
        }
      }
    }

    await workbook.xlsx.writeFile(filePath);

    await auditService.createLog(AuditAction.EXPORT, 'Export', {
      operator: options.operator,
      requestId: options.requestId,
      ipAddress: options.ipAddress,
      remark: `Exported ${batches.length} batches to Excel: ${filename}`,
    });

    logger.info(`Exported ${batches.length} batches to Excel`, {
      filename,
      requestId: options.requestId,
    });

    return filePath;
  }

  async exportQualityOrderToPdf(
    order: QualityOrder,
    batch: PrintBatch,
    options: {
      filename?: string;
      includeSensitive?: boolean;
      operator?: string;
      requestId?: string;
      ipAddress?: string;
    } = {}
  ): Promise<string> {
    const filename = options.filename || `quality_order_${order.orderNumber}_${Date.now()}.pdf`;
    const filePath = path.join(this.exportsDir, filename);

    const data = options.includeSensitive
      ? { order, batch }
      : { order: maskSensitiveData(order), batch: maskSensitiveData(batch) };

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      doc.fontSize(20).text('质检报告单', { align: 'center' });
      doc.moveDown();

      doc.fontSize(12);
      doc.text(`单号: ${data.order.orderNumber}`);
      doc.text(`日期: ${data.order.orderDate?.toISOString().split('T')[0]}`);
      doc.text(`检查员: ${data.order.inspector || '-'}`);
      doc.moveDown();

      doc.fontSize(14).text('一、批次信息', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(10);
      const batchInfo = [
        ['批次号', data.batch.batchNumber],
        ['产品名称', data.batch.productName],
        ['客户名称', data.batch.customerName || '-'],
        ['数量', data.batch.quantity || '-'],
        ['生产日期', data.batch.productionDate?.toISOString().split('T')[0] || '-'],
        ['机台号', data.batch.machineId || '-'],
        ['操作员', data.batch.operator || '-'],
        ['批次状态', data.batch.status],
        ['是否合格', data.batch.isPassed ? '是' : '否'],
        ['平均DeltaE', data.batch.avgDeltaE || '-'],
        ['是否返工', data.batch.hasRework ? '是' : '否'],
        ['返工次数', data.batch.reworkCount || 0],
      ];

      batchInfo.forEach(([label, value]) => {
        doc.text(`${label}: ${value}`);
      });

      doc.moveDown();

      doc.fontSize(14).text('二、检验结果', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(10);
      const inspectionInfo = [
        ['抽样数量', data.order.sampleCount || 0],
        ['合格数量', data.order.passCount || 0],
        ['不合格数量', data.order.failCount || 0],
        ['合格率', `${data.order.passRate || 0}%`],
        ['检验项目', data.order.inspectionItems || '-'],
      ];

      inspectionInfo.forEach(([label, value]) => {
        doc.text(`${label}: ${value}`);
      });

      doc.moveDown();

      if (data.batch.labRecords && data.batch.labRecords.length > 0) {
        doc.fontSize(14).text('三、Lab值明细', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10);
        const headers = ['序号', '测量点', 'L', 'a', 'b', '标准L', '标准a', '标准b', 'DeltaE', '是否合格'];
        const colWidths = [40, 80, 60, 60, 60, 60, 60, 60, 60, 60];
        let x = 50;
        let y = doc.y;

        headers.forEach((header, i) => {
          doc.text(header, x, y, { width: colWidths[i], align: 'center' });
          x += colWidths[i];
        });

        y += 20;

        data.batch.labRecords.forEach((lab, index) => {
          x = 50;
          const row = [
            index + 1,
            lab.measurePoint || '-',
            lab.L,
            lab.a,
            lab.b,
            lab.standardL || '-',
            lab.standardA || '-',
            lab.standardB || '-',
            lab.deltaE || '-',
            lab.isWithinTolerance ? '是' : '否',
          ];

          row.forEach((value, i) => {
            doc.text(String(value), x, y, { width: colWidths[i], align: 'center' });
            x += colWidths[i];
          });

          y += 15;
        });

        doc.y = y + 10;
      }

      doc.moveDown();

      doc.fontSize(14).text('四、缺陷描述', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(data.order.defectDescription || '无');

      doc.moveDown();

      doc.fontSize(14).text('五、结论', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(data.order.conclusion || '-');

      doc.moveDown(2);

      doc.fontSize(10);
      doc.text('批准人: _______________', { align: 'right' });
      doc.text('日期: _______________', { align: 'right' });

      doc.end();

      stream.on('finish', async () => {
        await auditService.createLog(AuditAction.EXPORT, 'Export', {
          entityId: order.id,
          batchNumber: batch.batchNumber,
          operator: options.operator,
          requestId: options.requestId,
          ipAddress: options.ipAddress,
          remark: `Exported quality order ${order.orderNumber} to PDF`,
        });

        logger.info(`Exported quality order ${order.orderNumber} to PDF`, {
          filename,
          requestId: options.requestId,
        });

        resolve(filePath);
      });

      stream.on('error', reject);
    });
  }

  async exportBatchDetailToExcel(batch: PrintBatch, options: {
    filename?: string;
    includeSensitive?: boolean;
    operator?: string;
    requestId?: string;
    ipAddress?: string;
  } = {}): Promise<string> {
    const filename = options.filename || `batch_${batch.batchNumber}_${Date.now()}.xlsx`;
    const filePath = path.join(this.exportsDir, filename);

    const data = options.includeSensitive ? batch : maskSensitiveData(batch);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'QC System';
    workbook.created = new Date();

    const mainSheet = workbook.addWorksheet('基本信息');

    const mainInfo = [
      ['批次号', data.batchNumber],
      ['产品名称', data.productName],
      ['客户名称', data.customerName || '-'],
      ['数量', data.quantity || '-'],
      ['生产日期', data.productionDate],
      ['机台号', data.machineId || '-'],
      ['状态', data.status],
      ['是否合格', data.isPassed ? '是' : '否'],
      ['平均DeltaE', data.avgDeltaE || '-'],
      ['是否返工', data.hasRework ? '是' : '否'],
      ['返工次数', data.reworkCount || 0],
      ['判定人', data.judgedBy || '-'],
      ['判定时间', data.judgedAt || '-'],
      ['判定备注', data.judgmentRemark || '-'],
      ['复核人', data.reviewedBy || '-'],
      ['复核时间', data.reviewedAt || '-'],
      ['复核备注', data.reviewRemark || '-'],
      ['操作员', data.operator || '-'],
      ['备注', data.remark || '-'],
    ];

    mainInfo.forEach((row) => {
      mainSheet.addRow(row);
    });

    mainSheet.getColumn(1).width = 15;
    mainSheet.getColumn(2).width = 30;

    if (data.labRecords?.length > 0) {
      const labSheet = workbook.addWorksheet('Lab值明细');

      labSheet.columns = [
        { header: '序号', key: 'index', width: 8 },
        { header: '测量点', key: 'measurePoint', width: 15 },
        { header: '测量顺序', key: 'measureOrder', width: 12 },
        { header: 'L值', key: 'L', width: 10 },
        { header: 'a值', key: 'a', width: 10 },
        { header: 'b值', key: 'b', width: 10 },
        { header: '标准L', key: 'standardL', width: 10 },
        { header: '标准a', key: 'standardA', width: 10 },
        { header: '标准b', key: 'standardB', width: 10 },
        { header: 'DeltaE', key: 'deltaE', width: 10 },
        { header: '公差', key: 'tolerance', width: 10 },
        { header: '是否合格', key: 'isWithinTolerance', width: 10 },
      ];

      labSheet.getRow(1).font = { bold: true };

      data.labRecords.forEach((lab, index) => {
        labSheet.addRow({
          index: index + 1,
          measurePoint: lab.measurePoint || '-',
          measureOrder: lab.measureOrder,
          L: lab.L,
          a: lab.a,
          b: lab.b,
          standardL: lab.standardL || '-',
          standardA: lab.standardA || '-',
          standardB: lab.standardB || '-',
          deltaE: lab.deltaE || '-',
          tolerance: lab.tolerance,
          isWithinTolerance: lab.isWithinTolerance ? '是' : '否',
        });
      });
    }

    if (data.reworkRecords?.length > 0) {
      const reworkSheet = workbook.addWorksheet('返工记录');

      reworkSheet.columns = [
        { header: '序号', key: 'index', width: 8 },
        { header: '返工类型', key: 'reworkType', width: 20 },
        { header: '原因', key: 'reason', width: 30 },
        { header: '解决方案', key: 'solution', width: 30 },
        { header: '返工次数', key: 'reworkCount', width: 12 },
        { header: '返工数量', key: 'reworkedQuantity', width: 12 },
        { header: '报废数量', key: 'scrappedQuantity', width: 12 },
        { header: '开始时间', key: 'startedAt', width: 20 },
        { header: '操作员', key: 'operator', width: 15 },
        { header: '备注', key: 'remark', width: 30 },
      ];

      reworkSheet.getRow(1).font = { bold: true };

      data.reworkRecords.forEach((rework, index) => {
        reworkSheet.addRow({
          index: index + 1,
          reworkType: rework.reworkType,
          reason: rework.reason,
          solution: rework.solution || '-',
          reworkCount: rework.reworkCount,
          reworkedQuantity: rework.reworkedQuantity || '-',
          scrappedQuantity: rework.scrappedQuantity || '-',
          startedAt: rework.startedAt,
          operator: rework.operator || '-',
          remark: rework.remark || '-',
        });
      });
    }

    await workbook.xlsx.writeFile(filePath);

    await auditService.createLog(AuditAction.EXPORT, 'Export', {
      entityId: batch.id,
      batchNumber: batch.batchNumber,
      operator: options.operator,
      requestId: options.requestId,
      ipAddress: options.ipAddress,
      remark: `Exported batch ${batch.batchNumber} detail to Excel`,
    });

    logger.info(`Exported batch ${batch.batchNumber} detail to Excel`, {
      filename,
      requestId: options.requestId,
    });

    return filePath;
  }
}

export const exportService = new ExportService();
