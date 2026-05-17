import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import {
  SamplingBatch,
  OriginalRecord,
  ReviewConclusion,
  ExceptionLog,
  SamplingReport,
} from '../models';
import { BatchStatus } from '../models/SamplingBatch';
import { ReviewResult } from '../models/ReviewConclusion';

export class ReportService {
  async generateReport(
    batchId: string,
    generatedBy: string
  ): Promise<SamplingReport> {
    const batch = await SamplingBatch.findByPk(batchId, {
      include: ['rule'],
    });

    if (!batch) {
      throw new Error('抽样批次不存在');
    }

    if (batch.status !== BatchStatus.REVIEW_COMPLETED) {
      throw new Error('批次复核未完成，无法生成报告');
    }

    const stats = await this.calculateStatistics(batchId);

    const reportNo = `REPORT-${Date.now()}`;
    const fileName = `${reportNo}.xlsx`;
    const reportsDir = path.join(process.cwd(), 'data', 'reports');

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filePath = path.join(reportsDir, fileName);
    await this.generateExcelFile(batchId, filePath);

    const report = await SamplingReport.create({
      batchId,
      reportNo,
      name: `${batch.name} 抽样复核报告`,
      summary: `批次 ${batch.batchNo} 的抽样复核报告，共抽样 ${stats.sampledCount} 条记录`,
      statistics: stats,
      filePath,
      fileType: 'excel',
      generatedBy,
      generatedAt: new Date(),
    });

    await batch.update({ status: BatchStatus.REPORT_GENERATED });

    return report;
  }

  private async calculateStatistics(batchId: string): Promise<{
    totalRecords: number;
    sampledCount: number;
    samplingRate: number;
    reviewedCount: number;
    passCount: number;
    failCount: number;
    pendingReview: number;
    passRate: number;
    exceptionCount: number;
  }> {
    const totalRecords = await OriginalRecord.count({ where: { batchId } });
    const sampledCount = await OriginalRecord.count({
      where: { batchId, isSampled: true },
    });
    const conclusions = await ReviewConclusion.findAll({ where: { batchId } });
    const exceptionCount = await ExceptionLog.count({ where: { batchId } });

    const passCount = conclusions.filter((c) => c.result === ReviewResult.PASS).length;
    const failCount = conclusions.filter((c) => c.result === ReviewResult.FAIL).length;
    const pendingReview = conclusions.filter(
      (c) => c.result === ReviewResult.PENDING || c.result === ReviewResult.NEEDS_REVIEW
    ).length;

    return {
      totalRecords,
      sampledCount,
      samplingRate: totalRecords > 0 ? sampledCount / totalRecords : 0,
      reviewedCount: conclusions.length,
      passCount,
      failCount,
      pendingReview,
      passRate: conclusions.length > 0 ? passCount / conclusions.length : 0,
      exceptionCount,
    };
  }

  private async generateExcelFile(batchId: string, filePath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const batch = await SamplingBatch.findByPk(batchId, { include: ['rule'] });

    const sheet1 = workbook.addWorksheet('概览');
    sheet1.columns = [
      { header: '批次编号', key: 'batchNo', width: 20 },
      { header: '批次名称', key: 'name', width: 30 },
      { header: '抽样方法', key: 'method', width: 15 },
      { header: '总记录数', key: 'totalRecords', width: 12 },
      { header: '抽样数', key: 'sampledCount', width: 12 },
      { header: '抽样率', key: 'samplingRate', width: 12 },
      { header: '通过数', key: 'passCount', width: 12 },
      { header: '失败数', key: 'failCount', width: 12 },
      { header: '通过率', key: 'passRate', width: 12 },
    ];

    const stats = await this.calculateStatistics(batchId);
    sheet1.addRow({
      batchNo: batch?.batchNo,
      name: batch?.name,
      method: (batch?.rule as any)?.method,
      totalRecords: stats.totalRecords,
      sampledCount: stats.sampledCount,
      samplingRate: (stats.samplingRate * 100).toFixed(2) + '%',
      passCount: stats.passCount,
      failCount: stats.failCount,
      passRate: (stats.passRate * 100).toFixed(2) + '%',
    });

    const sheet2 = workbook.addWorksheet('复核明细');
    sheet2.columns = [
      { header: '原始记录ID', key: 'originalId', width: 25 },
      { header: '数据源', key: 'dataSource', width: 15 },
      { header: '复核结果', key: 'result', width: 12 },
      { header: '复核人', key: 'reviewer', width: 15 },
      { header: '复核时间', key: 'createdAt', width: 20 },
      { header: '备注', key: 'comments', width: 40 },
      { header: '原始输入', key: 'rawInput', width: 50 },
    ];

    const conclusions = await ReviewConclusion.findAll({
      where: { batchId },
      include: ['originalRecord', 'reviewer'],
    });

    for (const conclusion of conclusions) {
      const record = conclusion.originalRecord as OriginalRecord;
      const reviewer = conclusion.reviewer as any;
      sheet2.addRow({
        originalId: record?.originalId,
        dataSource: record?.dataSource,
        result: conclusion.result,
        reviewer: reviewer?.username,
        createdAt: conclusion.createdAt?.toISOString(),
        comments: conclusion.comments,
        rawInput: record?.rawInput?.substring(0, 200),
      });
    }

    const sheet3 = workbook.addWorksheet('异常记录');
    sheet3.columns = [
      { header: '异常类型', key: 'type', width: 20 },
      { header: '错误信息', key: 'errorMessage', width: 40 },
      { header: '原始输入', key: 'rawInput', width: 50 },
      { header: '处理依据', key: 'processingBasis', width: 40 },
      { header: '创建时间', key: 'createdAt', width: 20 },
    ];

    const exceptions = await ExceptionLog.findAll({ where: { batchId } });
    for (const exception of exceptions) {
      sheet3.addRow({
        type: exception.type,
        errorMessage: exception.errorMessage,
        rawInput: exception.rawInput?.substring(0, 200),
        processingBasis: exception.processingBasis,
        createdAt: exception.createdAt?.toISOString(),
      });
    }

    await workbook.xlsx.writeFile(filePath);
  }

  async getReportById(reportId: string): Promise<SamplingReport | null> {
    return SamplingReport.findByPk(reportId, { include: ['batch'] });
  }

  async listReports(params?: {
    batchId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: SamplingReport[]; count: number }> {
    const { batchId, page = 1, pageSize = 20 } = params || {};
    const where: any = {};
    if (batchId) {
      where.batchId = batchId;
    }

    return SamplingReport.findAndCountAll({
      where,
      include: ['batch'],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      order: [['createdAt', 'DESC']],
    });
  }
}
