import type { CrackRecord, DiffField } from '../types';
import {
  STATUS_LABELS,
  SOURCE_LABELS,
  CRACK_TYPE_LABELS,
  RISK_LABELS,
  LOCATION_LABELS
} from '../types';

const FIELD_LABELS: Record<string, string> = {
  status: '状态',
  riskLevel: '风险等级',
  crackType: '裂纹类型',
  location: '部位',
  source: '数据来源',
  description: '裂纹描述',
  suggestion: '处理建议',
  remark: '备注',
  isOldCaliber: '口径标准',
  code: '编号'
};

const getValueLabel = (field: string, value: string | boolean): string => {
  if (typeof value === 'boolean') {
    return value ? '旧口径' : '新口径';
  }
  
  const labelMap: Record<string, Record<string, string>> = {
    status: STATUS_LABELS,
    source: SOURCE_LABELS,
    crackType: CRACK_TYPE_LABELS,
    riskLevel: RISK_LABELS,
    location: LOCATION_LABELS
  };
  
  if (labelMap[field] && labelMap[field][value]) {
    return labelMap[field][value];
  }
  
  return value;
};

export const compareRecords = (
  oldRecord: CrackRecord,
  newRecord: CrackRecord
): DiffField[] => {
  const diffs: DiffField[] = [];
  const compareFields: (keyof CrackRecord)[] = [
    'status',
    'riskLevel',
    'crackType',
    'location',
    'source',
    'description',
    'suggestion',
    'remark',
    'isOldCaliber',
    'code'
  ];

  compareFields.forEach(field => {
    const oldVal = oldRecord[field];
    const newVal = newRecord[field];
    
    if (oldVal !== newVal) {
      diffs.push({
        field,
        oldValue: String(oldVal),
        newValue: String(newVal)
      });
    }
  });

  return diffs;
};

export const formatDiffForDisplay = (diff: DiffField): {
  field: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  type: 'add' | 'remove' | 'modify';
} => {
  const fieldLabel = FIELD_LABELS[diff.field] || diff.field;
  const oldLabel = getValueLabel(diff.field, diff.oldValue);
  const newLabel = getValueLabel(diff.field, diff.newValue);
  
  let type: 'add' | 'remove' | 'modify' = 'modify';
  if (!diff.oldValue && diff.newValue) type = 'add';
  if (diff.oldValue && !diff.newValue) type = 'remove';

  return {
    field: diff.field,
    fieldLabel,
    oldValue: oldLabel,
    newValue: newLabel,
    type
  };
};

export const hasMeaningfulChanges = (
  oldRecord: CrackRecord,
  newRecord: CrackRecord
): boolean => {
  const diffs = compareRecords(oldRecord, newRecord);
  return diffs.length > 0;
};
