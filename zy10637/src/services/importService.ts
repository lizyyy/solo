import { v4 as uuidv4 } from 'uuid';
import { db } from '../store/database';
import { RedApplyStatus, OperationSource, ErrorType, ImportResult, Invoice, Order, RedApply, Attachment } from '../types';

interface ImportRow {
  invoiceCode: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: number;
  invoiceTaxAmount: number;
  invoiceTotalAmount: number;
  buyerName: string;
  buyerTaxId: string;
  sellerName: string;
  sellerTaxId: string;
  orderNo: string;
  orderDate: string;
  orderAmount: number;
  refundAmount: number;
  isPartialRefund: boolean;
  redReason: string;
  attachments?: Array<{
    fileName: string;
    fileType: string;
    fileSize: number;
  }>;
}

export class ImportService {
  validateRow(row: ImportRow, rowIndex: number): { valid: boolean; error?: string; errorType?: ErrorType } {
    if (!row.invoiceCode || !row.invoiceNumber) {
      return { valid: false, error: '发票代码和号码不能为空', errorType: ErrorType.DATA_INCOMPLETE };
    }
    if (!row.orderNo) {
      return { valid: false, error: '订单号不能为空', errorType: ErrorType.DATA_INCOMPLETE };
    }
    if (!row.redReason) {
      return { valid: false, error: '红冲原因不能为空', errorType: ErrorType.DATA_INCOMPLETE };
    }
    if (typeof row.invoiceTotalAmount !== 'number' || row.invoiceTotalAmount <= 0) {
      return { valid: false, error: '发票金额格式错误或小于等于0', errorType: ErrorType.INVALID_FORMAT };
    }
    if (typeof row.orderAmount !== 'number' || row.orderAmount <= 0) {
      return { valid: false, error: '订单金额格式错误或小于等于0', errorType: ErrorType.INVALID_FORMAT };
    }
    return { valid: true };
  }

  checkDuplicate(row: ImportRow): boolean {
    const existing = db.findByInvoiceKey('invoiceNumber', row.invoiceNumber);
    return !!existing;
  }

  async batchImport(
    rows: ImportRow[],
    operator: string,
    source: OperationSource = OperationSource.IMPORT
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      failedDetails: []
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const validation = this.validateRow(row, i);

      if (!validation.valid) {
        result.failed++;
        result.failedDetails.push({
          rowIndex: i,
          data: row as any,
          error: validation.error!,
          errorType: validation.errorType!
        });
        continue;
      }

      if (this.checkDuplicate(row)) {
        result.failed++;
        result.failedDetails.push({
          rowIndex: i,
          data: row as any,
          error: '发票记录已存在，不允许静默覆盖',
          errorType: ErrorType.DUPLICATE_RECORD
        });
        continue;
      }

      try {
        const invoice: Invoice = {
          id: uuidv4(),
          invoiceCode: row.invoiceCode,
          invoiceNumber: row.invoiceNumber,
          invoiceDate: row.invoiceDate,
          amount: row.invoiceAmount,
          taxAmount: row.invoiceTaxAmount,
          totalAmount: row.invoiceTotalAmount,
          buyerName: row.buyerName,
          buyerTaxId: row.buyerTaxId,
          sellerName: row.sellerName,
          sellerTaxId: row.sellerTaxId
        };

        const order: Order = {
          id: uuidv4(),
          orderNo: row.orderNo,
          orderDate: row.orderDate,
          orderAmount: row.orderAmount,
          refundAmount: row.refundAmount || 0,
          isPartialRefund: row.isPartialRefund || false
        };

        const attachments: Attachment[] = (row.attachments || []).map(a => ({
          id: uuidv4(),
          fileName: a.fileName,
          fileType: a.fileType,
          fileSize: a.fileSize,
          uploadTime: new Date().toISOString()
        }));

        const redApply = db.addRedApply({
          invoice,
          order,
          redReason: row.redReason,
          attachments,
          status: RedApplyStatus.PENDING_APPLY
        });

        db.addHistoryRecord({
          redApplyId: redApply.id,
          operationSource: source,
          operator,
          operationType: '导入创建',
          toStatus: RedApplyStatus.PENDING_APPLY,
          remark: '批量导入创建红冲申请记录'
        });

        result.success++;
      } catch (error) {
        result.failed++;
        result.failedDetails.push({
          rowIndex: i,
          data: row as any,
          error: '系统处理异常',
          errorType: ErrorType.NEED_MANUAL
        });
      }
    }

    return result;
  }
}

export const importService = new ImportService();
