import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import { RecalculationApplication } from '../types';

export class ExportService {
  private exportDir: string;

  constructor() {
    this.exportDir = path.join(__dirname, '../../data/exports');
  }

  async exportToCSV(applications: RecalculationApplication[]): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `billing_recalculation_${timestamp}.csv`;
    const filePath = path.join(this.exportDir, filename);

    await this.ensureExportDir();

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '申请ID' },
        { id: 'billingMonth', title: '账单月份' },
        { id: 'customerAccount', title: '客户账号' },
        { id: 'customerName', title: '客户名称' },
        { id: 'reasonCategory', title: '原因分类' },
        { id: 'reasonDetail', title: '原因详情' },
        { id: 'triggerSource', title: '触发来源' },
        { id: 'totalOriginalAmount', title: '原始总金额' },
        { id: 'totalNewAmount', title: '新总金额' },
        { id: 'totalDifference', title: '差异金额' },
        { id: 'status', title: '状态' },
        { id: 'currentApprover', title: '当前审批人' },
        { id: 'finalConclusion', title: '最终结论' },
        { id: 'createdBy', title: '创建人' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'updatedAt', title: '更新时间' }
      ]
    });

    const records = applications.map(app => ({
      id: app.id,
      billingMonth: app.billingMonth,
      customerAccount: app.customerAccount,
      customerName: app.customerName,
      reasonCategory: app.reasonCategory,
      reasonDetail: app.reasonDetail,
      triggerSource: app.triggerSource,
      totalOriginalAmount: app.totalOriginalAmount,
      totalNewAmount: app.totalNewAmount,
      totalDifference: app.totalDifference,
      status: app.status,
      currentApprover: app.currentApprover || '',
      finalConclusion: app.finalConclusion || '',
      createdBy: app.createdBy,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt
    }));

    await csvWriter.writeRecords(records);

    const detailsFilename = `billing_recalculation_details_${timestamp}.csv`;
    const detailsFilePath = path.join(this.exportDir, detailsFilename);
    
    const detailsCsvWriter = createObjectCsvWriter({
      path: detailsFilePath,
      header: [
        { id: 'applicationId', title: '申请ID' },
        { id: 'itemCode', title: '项目编码' },
        { id: 'itemName', title: '项目名称' },
        { id: 'originalAmount', title: '原始金额' },
        { id: 'newAmount', title: '新金额' },
        { id: 'difference', title: '差异' },
        { id: 'remarks', title: '备注' }
      ]
    });

    const detailRecords = applications.flatMap(app => 
      app.impactDetails.map(detail => ({
        applicationId: app.id,
        itemCode: detail.itemCode,
        itemName: detail.itemName,
        originalAmount: detail.originalAmount,
        newAmount: detail.newAmount,
        difference: detail.difference,
        remarks: detail.remarks || ''
      }))
    );

    await detailsCsvWriter.writeRecords(detailRecords);

    return filePath;
  }

  async exportReport(application: RecalculationApplication): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `recalculation_report_${application.id}_${timestamp}.csv`;
    const filePath = path.join(this.exportDir, filename);

    await this.ensureExportDir();

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'field', title: '字段' },
        { id: 'value', title: '值' }
      ]
    });

    const records = [
      { field: '申请ID', value: application.id },
      { field: '幂等键', value: application.idempotencyKey },
      { field: '账单月份', value: application.billingMonth },
      { field: '客户账号', value: application.customerAccount },
      { field: '客户名称', value: application.customerName },
      { field: '原因分类', value: application.reasonCategory },
      { field: '原因详情', value: application.reasonDetail },
      { field: '触发来源', value: application.triggerSource },
      { field: '原始总金额', value: application.totalOriginalAmount.toString() },
      { field: '新总金额', value: application.totalNewAmount.toString() },
      { field: '差异金额', value: application.totalDifference.toString() },
      { field: '状态', value: application.status },
      { field: '当前审批人', value: application.currentApprover || '' },
      { field: '失败原因', value: application.failureReason || '' },
      { field: '处理依据', value: application.processingBasis || '' },
      { field: '最终结论', value: application.finalConclusion || '' },
      { field: '创建人', value: application.createdBy },
      { field: '创建时间', value: application.createdAt },
      { field: '更新时间', value: application.updatedAt }
    ];

    await csvWriter.writeRecords(records);

    return filePath;
  }

  private async ensureExportDir(): Promise<void> {
    const fs = require('fs').promises;
    try {
      await fs.access(this.exportDir);
    } catch {
      await fs.mkdir(this.exportDir, { recursive: true });
    }
  }
}