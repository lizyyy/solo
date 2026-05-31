import { DiffItem, WarningRecord } from '../types';

export function compareRecords(oldRecord: WarningRecord, newRecord: WarningRecord): DiffItem[] {
  const diffs: DiffItem[] = [];
  const fieldsToCompare: (keyof WarningRecord)[] = [
    'supplierName',
    'billAmount',
    'warningType',
    'status',
    'source',
    'currentRemark',
    'processingAdvice',
  ];

  fieldsToCompare.forEach((field) => {
    const oldValue = oldRecord[field];
    const newValue = newRecord[field];
    
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      diffs.push({
        field,
        oldValue,
        newValue,
        type: 'modify',
      });
    }
  });

  return diffs;
}

export function isRecordSame(a: WarningRecord, b: WarningRecord): boolean {
  return (
    a.supplierName === b.supplierName &&
    a.billAmount === b.billAmount &&
    a.warningType === b.warningType
  );
}

export function isConflict(a: WarningRecord, b: WarningRecord): boolean {
  const coreFields: (keyof WarningRecord)[] = ['billAmount', 'warningType'];
  return coreFields.some((field) => a[field] !== b[field]);
}

export function formatFieldName(field: string): string {
  const fieldNames: Record<string, string> = {
    supplierName: '供应商名称',
    billAmount: '票据金额',
    warningType: '预警类型',
    status: '状态',
    source: '数据来源',
    originalRemark: '原始备注',
    currentRemark: '当前备注',
    processingAdvice: '处理建议',
    createdAt: '创建时间',
    updatedAt: '更新时间',
  };
  return fieldNames[field] || field;
}
