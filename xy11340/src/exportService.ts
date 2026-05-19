import fs from 'fs';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { WarehouseDB } from './database';

export class ExportService {
  private db: WarehouseDB;

  constructor(db: WarehouseDB) {
    this.db = db;
  }

  async exportClaimsToCsv(outputPath: string, status?: string): Promise<string> {
    let claims = await this.db.getAllClaims();
    
    if (status) {
      claims = claims.filter(c => c.status === status);
    }

    const records = claims.map(claim => ({
      claimNo: claim.claimNo,
      repairNo: claim.repairNo,
      workOrderNo: claim.workOrderNo,
      ruleCode: claim.ruleCode,
      partCode: claim.partCode,
      claimAmount: claim.claimAmount.toFixed(2),
      status: claim.status,
      reviewedBy: claim.reviewedBy || '',
      reviewedAt: claim.reviewedAt || '',
      rejectionReason: claim.rejectionReason || '',
      createdAt: claim.createdAt || ''
    }));

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'claimNo', title: '索赔单号' },
        { id: 'repairNo', title: '返修单号' },
        { id: 'workOrderNo', title: '工单号' },
        { id: 'ruleCode', title: '规则编号' },
        { id: 'partCode', title: '配件编码' },
        { id: 'claimAmount', title: '索赔金额' },
        { id: 'status', title: '状态' },
        { id: 'reviewedBy', title: '审核人' },
        { id: 'reviewedAt', title: '审核时间' },
        { id: 'rejectionReason', title: '驳回原因' },
        { id: 'createdAt', title: '创建时间' }
      ]
    });

    await csvWriter.writeRecords(records);
    return outputPath;
  }

  async exportPartOrdersToCsv(outputPath: string): Promise<string> {
    const partOrders = await this.db.getAllPartOrders();

    const records = partOrders.map(order => ({
      orderNo: order.orderNo,
      engineerId: order.engineerId,
      engineerName: order.engineerName,
      partCode: order.partCode,
      partName: order.partName,
      quantity: order.quantity,
      unit: order.unit,
      receiveDate: order.receiveDate,
      workOrderNo: order.workOrderNo,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      status: order.status,
      createdAt: order.createdAt || ''
    }));

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'orderNo', title: '领件单号' },
        { id: 'engineerId', title: '工程师ID' },
        { id: 'engineerName', title: '工程师姓名' },
        { id: 'partCode', title: '配件编码' },
        { id: 'partName', title: '配件名称' },
        { id: 'quantity', title: '数量' },
        { id: 'unit', title: '单位' },
        { id: 'receiveDate', title: '领件日期' },
        { id: 'workOrderNo', title: '工单号' },
        { id: 'customerName', title: '客户姓名' },
        { id: 'customerPhone', title: '客户电话' },
        { id: 'status', title: '状态' },
        { id: 'createdAt', title: '创建时间' }
      ]
    });

    await csvWriter.writeRecords(records);
    return outputPath;
  }

  async exportRepairOrdersToJson(outputPath: string): Promise<string> {
    const repairOrders = await this.db.getAllRepairOrders();
    fs.writeFileSync(outputPath, JSON.stringify(repairOrders, null, 2), 'utf-8');
    return outputPath;
  }

  async exportImportErrorsToCsv(outputPath: string, batch?: string): Promise<string> {
    const errors = await this.db.getImportErrors(batch);

    const records = errors.map(error => ({
      importBatch: error.importBatch,
      importType: error.importType,
      sourceFile: error.sourceFile,
      rowNumber: error.rowNumber,
      rawData: error.rawData,
      errorType: error.errorType,
      errorMessage: error.errorMessage,
      suggestion: error.suggestion,
      resolved: error.resolved ? '是' : '否',
      resolvedBy: error.resolvedBy || '',
      resolvedAt: error.resolvedAt || '',
      createdAt: error.createdAt || ''
    }));

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'importBatch', title: '导入批次' },
        { id: 'importType', title: '导入类型' },
        { id: 'sourceFile', title: '源文件' },
        { id: 'rowNumber', title: '行号' },
        { id: 'rawData', title: '原始数据' },
        { id: 'errorType', title: '错误类型' },
        { id: 'errorMessage', title: '错误信息' },
        { id: 'suggestion', title: '修改建议' },
        { id: 'resolved', title: '已解决' },
        { id: 'resolvedBy', title: '解决人' },
        { id: 'resolvedAt', title: '解决时间' },
        { id: 'createdAt', title: '创建时间' }
      ]
    });

    await csvWriter.writeRecords(records);
    return outputPath;
  }

  async exportClaimSummaryToJson(outputPath: string): Promise<string> {
    const claims = await this.db.getAllClaims();
    const summary = {
      exportDate: new Date().toISOString(),
      totalClaims: claims.length,
      byStatus: {
        pending: claims.filter(c => c.status === 'pending').length,
        approved: claims.filter(c => c.status === 'approved').length,
        rejected: claims.filter(c => c.status === 'rejected').length
      },
      amounts: {
        total: claims.reduce((sum, c) => sum + c.claimAmount, 0),
        approved: claims.filter(c => c.status === 'approved').reduce((sum, c) => sum + c.claimAmount, 0),
        pending: claims.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.claimAmount, 0)
      },
      details: claims
    };

    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf-8');
    return outputPath;
  }

  ensureExportDir(): string {
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    return exportDir;
  }
}
