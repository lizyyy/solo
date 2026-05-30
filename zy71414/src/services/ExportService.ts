import * as XLSX from 'xlsx';
import type { DiscountApplication, PaymentRecord } from '../types';
import { STATUS_LABELS } from '../types';

export class ExportService {
  static exportToCSV(applications: DiscountApplication[]): Blob {
    const headers = [
      '申请编号',
      '供应商名称',
      '供应商等级',
      '应付金额',
      '原到期日',
      '拟付款日',
      '折扣率(%)',
      '折扣金额',
      '实际付款',
      '状态',
      '创建时间',
      '创建人',
    ];

    const rows = applications.map((app) => [
      app.applicationNo,
      app.supplierName,
      app.supplierLevel,
      app.payableAmount.toFixed(2),
      app.originalDueDate,
      app.proposedDueDate,
      (app.discountRate * 100).toFixed(2),
      app.discountAmount.toFixed(2),
      app.actualPaymentAmount.toFixed(2),
      STATUS_LABELS[app.status],
      app.createdAt,
      app.createdBy,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join(
      '\n'
    );

    return new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
  }

  static exportToExcel(
    applications: DiscountApplication[],
    payments?: PaymentRecord[]
  ): Blob {
    const wb = XLSX.utils.book_new();

    const appData = applications.map((app) => ({
      申请编号: app.applicationNo,
      供应商名称: app.supplierName,
      供应商等级: app.supplierLevel,
      应付金额: app.payableAmount,
      原到期日: app.originalDueDate,
      拟付款日: app.proposedDueDate,
      折扣率: `${(app.discountRate * 100).toFixed(2)}%`,
      折扣金额: app.discountAmount,
      实际付款: app.actualPaymentAmount,
      状态: STATUS_LABELS[app.status],
      版本: app.currentVersion,
      创建时间: app.createdAt,
      创建人: app.createdBy,
    }));

    const ws1 = XLSX.utils.json_to_sheet(appData);
    XLSX.utils.book_append_sheet(wb, ws1, '折扣申请');

    if (payments && payments.length > 0) {
      const paymentData = payments.map((p) => ({
        付款编号: p.paymentNo,
        关联申请: p.applicationId,
        付款金额: p.amount,
        付款日期: p.paymentDate,
        版本: p.version,
        是否重复: p.isDuplicate ? '是' : '否',
        操作人: p.operator,
        状态: p.status,
      }));
      const ws2 = XLSX.utils.json_to_sheet(paymentData);
      XLSX.utils.book_append_sheet(wb, ws2, '付款记录');
    }

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  static downloadBlob(blob: Blob, filename: string): void {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static generateFilename(prefix: string, format: 'csv' | 'xlsx'): string {
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return `${prefix}_${timestamp}.${format}`;
  }
}
