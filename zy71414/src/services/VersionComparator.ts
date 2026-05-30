import type { DiscountApplication, VersionDiff } from '../types';

const FIELD_NAMES: Record<string, string> = {
  supplierId: '供应商ID',
  supplierName: '供应商名称',
  supplierLevel: '供应商等级',
  payableId: '应付账款ID',
  payableAmount: '应付金额',
  originalDueDate: '原到期日',
  proposedDueDate: '拟付款日',
  discountRate: '折扣率',
  discountAmount: '折扣金额',
  actualPaymentAmount: '实际付款金额',
  status: '状态',
  remark: '备注',
};

export class VersionComparator {
  static compareVersions(
    v1: DiscountApplication,
    v2: DiscountApplication
  ): VersionDiff[] {
    const diffs: VersionDiff[] = [];
    const fieldsToCompare: (keyof DiscountApplication)[] = [
      'supplierId',
      'supplierName',
      'supplierLevel',
      'payableId',
      'payableAmount',
      'originalDueDate',
      'proposedDueDate',
      'discountRate',
      'discountAmount',
      'actualPaymentAmount',
      'status',
      'remark',
    ];

    for (const field of fieldsToCompare) {
      const oldValue = v1[field];
      const newValue = v2[field];
      const oldStr = String(oldValue ?? '');
      const newStr = String(newValue ?? '');

      let changeType: VersionDiff['changeType'] = 'UNCHANGED';

      if (oldValue === undefined && newValue !== undefined) {
        changeType = 'ADD';
      } else if (oldValue !== undefined && newValue === undefined) {
        changeType = 'DELETE';
      } else if (oldStr !== newStr) {
        changeType = 'MODIFY';
      }

      diffs.push({
        field,
        fieldName: FIELD_NAMES[field] || field,
        oldValue,
        newValue,
        changeType,
      });
    }

    return diffs;
  }

  static isSubstantiveChange(diffs: VersionDiff[]): boolean {
    return diffs.some((d) => d.changeType !== 'UNCHANGED');
  }

  static getChangedFields(diffs: VersionDiff[]): VersionDiff[] {
    return diffs.filter((d) => d.changeType !== 'UNCHANGED');
  }

  static formatValue(value: any): string {
    if (value === undefined || value === null) {
      return '-';
    }
    if (typeof value === 'number') {
      return value.toLocaleString('zh-CN', { minimumFractionDigits: 2 });
    }
    return String(value);
  }
}
