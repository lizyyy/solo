import fs from 'fs';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { 
  Invoice, 
  ValidationResult, 
  ExportOptions,
  HistoryRecord 
} from '../types/invoice';
import { formatDate } from '../utils/helpers';

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'json',
  includeRawData: false,
  includeErrors: true,
  includeDuplicates: true,
  includeRedInvoices: true
};

export class ExportService {
  async exportReport(
    invoices: Invoice[],
    validationResult: ValidationResult,
    outputPath: string,
    options?: Partial<ExportOptions>
  ): Promise<string> {
    const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
    const exportData = this.prepareExportData(invoices, validationResult, opts);
    
    const fullPath = this.ensureOutputPath(outputPath, opts.format);
    
    if (opts.format === 'json') {
      return this.exportToJSON(exportData, fullPath);
    } else {
      return this.exportToCSV(exportData, fullPath);
    }
  }

  async exportHistory(
    historyRecords: HistoryRecord[],
    outputPath: string,
    options?: Partial<ExportOptions>
  ): Promise<string> {
    const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
    const fullPath = this.ensureOutputPath(outputPath, opts.format);
    
    const data = historyRecords.map(record => ({
      id: record.id,
      batchId: record.batchId,
      importTime: formatDate(record.importTime),
      fileName: record.fileName,
      totalRecords: record.totalRecords,
      validRecords: record.validRecords,
      invalidRecords: record.invalidRecords
    }));
    
    if (opts.format === 'json') {
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
    } else {
      await this.exportArrayToCSV(data, fullPath, [
        { id: 'id', title: 'ID' },
        { id: 'batchId', title: '批次号' },
        { id: 'importTime', title: '导入时间' },
        { id: 'fileName', title: '文件名' },
        { id: 'totalRecords', title: '总记录数' },
        { id: 'validRecords', title: '有效记录' },
        { id: 'invalidRecords', title: '无效记录' }
      ]);
    }
    
    return fullPath;
  }

  async exportDuplicates(
    validationResult: ValidationResult,
    outputPath: string,
    options?: Partial<ExportOptions>
  ): Promise<string> {
    const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
    const fullPath = this.ensureOutputPath(outputPath, opts.format);
    
    const duplicateData: any[] = [];
    for (const group of validationResult.duplicateGroups) {
      for (let i = 0; i < group.invoices.length; i++) {
        const invoice = group.invoices[i];
        duplicateData.push({
          groupKey: group.key,
          position: i + 1,
          isRecommended: group.recommendedInvoice?.id === invoice.id ? '是' : '否',
          invoiceCode: invoice.invoiceCode,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          amount: invoice.amount,
          taxAmount: invoice.taxAmount,
          totalAmount: invoice.totalAmount,
          sellerName: invoice.sellerName,
          buyerName: invoice.buyerName,
          batchId: invoice.importBatchId
        });
      }
    }
    
    if (opts.format === 'json') {
      fs.writeFileSync(fullPath, JSON.stringify(duplicateData, null, 2), 'utf8');
    } else {
      await this.exportArrayToCSV(duplicateData, fullPath, [
        { id: 'groupKey', title: '重复组' },
        { id: 'position', title: '序号' },
        { id: 'isRecommended', title: '推荐保留' },
        { id: 'invoiceCode', title: '发票代码' },
        { id: 'invoiceNumber', title: '发票号码' },
        { id: 'invoiceDate', title: '开票日期' },
        { id: 'amount', title: '金额' },
        { id: 'taxAmount', title: '税额' },
        { id: 'totalAmount', title: '价税合计' },
        { id: 'sellerName', title: '销售方' },
        { id: 'buyerName', title: '购买方' },
        { id: 'batchId', title: '导入批次' }
      ]);
    }
    
    return fullPath;
  }

  async exportRedInvoices(
    validationResult: ValidationResult,
    outputPath: string,
    options?: Partial<ExportOptions>
  ): Promise<string> {
    const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
    const fullPath = this.ensureOutputPath(outputPath, opts.format);
    
    const redInvoiceData: any[] = [];
    for (const relation of validationResult.redInvoiceRelations) {
      redInvoiceData.push({
        isValid: relation.isValid ? '有效' : '无效',
        reason: relation.reason || '',
        redInvoiceCode: relation.redInvoice.invoiceCode,
        redInvoiceNumber: relation.redInvoice.invoiceNumber,
        redInvoiceDate: relation.redInvoice.invoiceDate,
        redAmount: relation.redInvoice.totalAmount,
        originalInvoiceCode: relation.originalInvoice?.invoiceCode || '',
        originalInvoiceNumber: relation.originalInvoice?.invoiceNumber || '',
        originalInvoiceDate: relation.originalInvoice?.invoiceDate || '',
        originalAmount: relation.originalInvoice?.totalAmount || 0
      });
    }
    
    if (opts.format === 'json') {
      fs.writeFileSync(fullPath, JSON.stringify(redInvoiceData, null, 2), 'utf8');
    } else {
      await this.exportArrayToCSV(redInvoiceData, fullPath, [
        { id: 'isValid', title: '红冲有效性' },
        { id: 'reason', title: '原因' },
        { id: 'redInvoiceCode', title: '红冲发票代码' },
        { id: 'redInvoiceNumber', title: '红冲发票号码' },
        { id: 'redInvoiceDate', title: '红冲开票日期' },
        { id: 'redAmount', title: '红冲金额' },
        { id: 'originalInvoiceCode', title: '原发票代码' },
        { id: 'originalInvoiceNumber', title: '原发票号码' },
        { id: 'originalInvoiceDate', title: '原开票日期' },
        { id: 'originalAmount', title: '原发票金额' }
      ]);
    }
    
    return fullPath;
  }

  async exportErrors(
    validationResult: ValidationResult,
    outputPath: string,
    options?: Partial<ExportOptions>
  ): Promise<string> {
    const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
    const fullPath = this.ensureOutputPath(outputPath, opts.format);
    
    const errorData = validationResult.errors.map((error, index) => ({
      id: index + 1,
      type: this.translateErrorType(error.type),
      message: error.message,
      field: error.field || '',
      relatedInvoiceId: error.relatedInvoiceId || ''
    }));
    
    if (opts.format === 'json') {
      fs.writeFileSync(fullPath, JSON.stringify(errorData, null, 2), 'utf8');
    } else {
      await this.exportArrayToCSV(errorData, fullPath, [
        { id: 'id', title: '序号' },
        { id: 'type', title: '错误类型' },
        { id: 'message', title: '错误信息' },
        { id: 'field', title: '涉及字段' },
        { id: 'relatedInvoiceId', title: '关联发票ID' }
      ]);
    }
    
    return fullPath;
  }

  private prepareExportData(
    invoices: Invoice[],
    validationResult: ValidationResult,
    options: ExportOptions
  ): any {
    const summary = {
      totalInvoices: validationResult.totalInvoices,
      validInvoices: validationResult.validInvoices,
      invalidInvoices: validationResult.invalidInvoices,
      duplicateGroups: validationResult.duplicateGroups.length,
      redInvoiceRelations: validationResult.redInvoiceRelations.length,
      validRedInvoices: validationResult.redInvoiceRelations.filter(r => r.isValid).length,
      invalidRedInvoices: validationResult.redInvoiceRelations.filter(r => !r.isValid).length,
      errors: validationResult.errors.length,
      processingTime: `${validationResult.processingTime}ms`
    };

    const invoiceData = invoices.map(inv => {
      const baseData: any = {
        id: inv.id,
        invoiceCode: inv.invoiceCode,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        amount: inv.amount,
        taxAmount: inv.taxAmount,
        totalAmount: inv.totalAmount,
        sellerName: inv.sellerName,
        buyerName: inv.buyerName,
        invoiceType: inv.invoiceType,
        status: inv.status,
        isRedInvoice: inv.isRedInvoice,
        originalInvoiceNumber: inv.originalInvoiceNumber || '',
        originalInvoiceCode: inv.originalInvoiceCode || '',
        remark: inv.remark || '',
        batchId: inv.importBatchId,
        importTime: inv.importTime ? formatDate(inv.importTime) : '',
        hasErrors: inv.validationErrors && inv.validationErrors.length > 0,
        errorCount: inv.validationErrors?.length || 0
      };

      if (options.includeErrors && inv.validationErrors) {
        baseData.errors = inv.validationErrors.map(e => ({
          type: this.translateErrorType(e.type),
          message: e.message
        }));
      }

      if (options.includeRawData && inv.rawData) {
        baseData.rawData = inv.rawData;
      }

      return baseData;
    });

    return {
      summary,
      invoices: invoiceData,
      exportTime: formatDate(new Date())
    };
  }

  private async exportToJSON(data: any, outputPath: string): Promise<string> {
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    return outputPath;
  }

  private async exportToCSV(data: any, outputPath: string): Promise<string> {
    const records = data.invoices;
    const headers = [
      { id: 'invoiceCode', title: '发票代码' },
      { id: 'invoiceNumber', title: '发票号码' },
      { id: 'invoiceDate', title: '开票日期' },
      { id: 'amount', title: '金额' },
      { id: 'taxAmount', title: '税额' },
      { id: 'totalAmount', title: '价税合计' },
      { id: 'sellerName', title: '销售方' },
      { id: 'buyerName', title: '购买方' },
      { id: 'invoiceType', title: '发票类型' },
      { id: 'status', title: '状态' },
      { id: 'isRedInvoice', title: '是否红冲' },
      { id: 'originalInvoiceCode', title: '原发票代码' },
      { id: 'originalInvoiceNumber', title: '原发票号码' },
      { id: 'remark', title: '备注' },
      { id: 'batchId', title: '批次号' },
      { id: 'hasErrors', title: '是否有错误' },
      { id: 'errorCount', title: '错误数' }
    ];
    
    await this.exportArrayToCSV(records, outputPath, headers);
    return outputPath;
  }

  private async exportArrayToCSV(
    records: any[],
    outputPath: string,
    headers: { id: string; title: string }[]
  ): Promise<void> {
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: headers
    });
    
    await csvWriter.writeRecords(records);
  }

  private ensureOutputPath(outputPath: string, format: 'csv' | 'json'): string {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const ext = path.extname(outputPath).toLowerCase();
    if (ext !== `.${format}`) {
      return outputPath + `.${format}`;
    }
    
    return outputPath;
  }

  private translateErrorType(type: string): string {
    const translations: Record<string, string> = {
      'DUPLICATE_INVOICE': '重复发票',
      'RED_INVOICE_WITHOUT_ORIGINAL': '红冲发票无对应原票',
      'RED_INVOICE_AMOUNT_MISMATCH': '红冲金额不一致',
      'AMOUNT_TOTAL_MISMATCH': '金额合计不一致',
      'INVALID_INVOICE_NUMBER': '无效发票号码',
      'INVALID_INVOICE_CODE': '无效发票代码',
      'INVALID_DATE': '无效日期',
      'INVALID_AMOUNT': '无效金额',
      'MISSING_REQUIRED_FIELD': '缺少必填字段'
    };
    
    return translations[type] || type;
  }
}

let exportServiceInstance: ExportService | null = null;

export function getExportService(): ExportService {
  if (!exportServiceInstance) {
    exportServiceInstance = new ExportService();
  }
  return exportServiceInstance;
}
