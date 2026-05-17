import { Parser } from 'json2csv';
import { db } from '../store/database';
import { RedApplyStatus, OperationSource, RedApply } from '../types';

export class ExportService {
  exportToCSV(applies?: RedApply[]): string {
    const data = applies || db.listRedApplies();
    
    const flatData = data.map(row => ({
      id: row.id,
      status: row.status,
      redReason: row.redReason,
      rejectReason: row.rejectReason || '',
      invoiceCode: row.invoice.invoiceCode,
      invoiceNumber: row.invoice.invoiceNumber,
      invoiceDate: row.invoice.invoiceDate,
      invoiceAmount: row.invoice.amount,
      invoiceTaxAmount: row.invoice.taxAmount,
      invoiceTotalAmount: row.invoice.totalAmount,
      buyerName: row.invoice.buyerName,
      buyerTaxId: row.invoice.buyerTaxId,
      sellerName: row.invoice.sellerName,
      sellerTaxId: row.invoice.sellerTaxId,
      orderNo: row.order.orderNo,
      orderDate: row.order.orderDate,
      orderAmount: row.order.orderAmount,
      refundAmount: row.order.refundAmount,
      isPartialRefund: row.order.isPartialRefund ? '是' : '否',
      attachmentCount: row.attachments.length,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));

    const fields = [
      { label: 'ID', value: 'id' },
      { label: '状态', value: 'status' },
      { label: '红冲原因', value: 'redReason' },
      { label: '驳回原因', value: 'rejectReason' },
      { label: '发票代码', value: 'invoiceCode' },
      { label: '发票号码', value: 'invoiceNumber' },
      { label: '发票日期', value: 'invoiceDate' },
      { label: '发票金额', value: 'invoiceAmount' },
      { label: '发票税额', value: 'invoiceTaxAmount' },
      { label: '发票价税合计', value: 'invoiceTotalAmount' },
      { label: '购方名称', value: 'buyerName' },
      { label: '购方税号', value: 'buyerTaxId' },
      { label: '销方名称', value: 'sellerName' },
      { label: '销方税号', value: 'sellerTaxId' },
      { label: '订单号', value: 'orderNo' },
      { label: '订单日期', value: 'orderDate' },
      { label: '订单金额', value: 'orderAmount' },
      { label: '退款金额', value: 'refundAmount' },
      { label: '是否部分退款', value: 'isPartialRefund' },
      { label: '附件数量', value: 'attachmentCount' },
      { label: '创建时间', value: 'createdAt' },
      { label: '更新时间', value: 'updatedAt' }
    ];

    try {
      const json2csvParser = new Parser({ fields });
      return json2csvParser.parse(flatData);
    } catch (error) {
      console.error('CSV export error:', error);
      return JSON.stringify(flatData);
    }
  }

  exportByStatus(status?: RedApplyStatus): string {
    const applies = db.listRedApplies(status ? { status } : undefined);
    return this.exportToCSV(applies);
  }

  exportByIds(ids: string[]): { success: string[]; failed: string[]; csv: string } {
    const success: string[] = [];
    const failed: string[] = [];
    const applies: RedApply[] = [];

    for (const id of ids) {
      const apply = db.getRedApply(id);
      if (apply) {
        success.push(id);
        applies.push(apply);
      } else {
        failed.push(id);
      }
    }

    return {
      success,
      failed,
      csv: this.exportToCSV(applies)
    };
  }
}

export const exportService = new ExportService();
