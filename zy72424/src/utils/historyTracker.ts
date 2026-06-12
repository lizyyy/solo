import { diff_match_patch } from 'diff-match-patch';
import { ChangeHistory, ChangeType, DiffResult, EntityType } from '../types';
import { generateId } from './boundaryRules';

const dmp = new diff_match_patch();

export function recordChange<T>(
  entityType: EntityType,
  recordId: string,
  oldData: T,
  newData: T,
  fieldName: keyof T,
  changedBy: string,
  changeType: ChangeType = 'update'
): ChangeHistory | null {
  const oldValue = String(oldData[fieldName] ?? '');
  const newValue = String(newData[fieldName] ?? '');

  if (oldValue === newValue && changeType === 'update') {
    return null;
  }

  return {
    id: generateId('history'),
    entityType,
    recordId,
    fieldName: String(fieldName),
    oldValue,
    newValue,
    changedBy,
    changedAt: new Date(),
    changeType,
  };
}

export function generateDiff(oldValue: string, newValue: string): DiffResult {
  const diffs = dmp.diff_main(oldValue, newValue);
  dmp.diff_cleanupSemantic(diffs);

  const result: DiffResult = {
    added: [],
    removed: [],
    unchanged: [],
  };

  let position = 0;
  for (const diff of diffs) {
    const [operation, text] = diff;
    if (operation === 1) {
      result.added.push({ value: text, position });
    } else if (operation === -1) {
      result.removed.push({ value: text, position });
    } else {
      result.unchanged.push({ value: text, position });
    }
    position += text.length;
  }

  return result;
}

export function renderDiffToHtml(oldValue: string, newValue: string): string {
  const diffs = dmp.diff_main(oldValue, newValue);
  dmp.diff_cleanupSemantic(diffs);

  let html = '';
  for (const diff of diffs) {
    const [operation, text] = diff;
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    if (operation === 1) {
      html += `<span style="background-color: #dcfce7; color: #166534; padding: 0 2px;">${escapedText}</span>`;
    } else if (operation === -1) {
      html += `<span style="background-color: #fee2e2; color: #991b1b; text-decoration: line-through; padding: 0 2px;">${escapedText}</span>`;
    } else {
      html += `<span>${escapedText}</span>`;
    }
  }

  return html;
}

export function rollbackChange(
  history: ChangeHistory,
  currentData: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...currentData,
    [history.fieldName]: history.oldValue,
  };
}

export function getChangeTypeText(type: ChangeType): string {
  const typeMap: Record<ChangeType, string> = {
    create: '创建',
    update: '更新',
    delete: '删除',
    rollback: '回滚',
  };
  return typeMap[type] || type;
}

export function getFieldNameText(fieldName: string): string {
  const fieldMap: Record<string, string> = {
    remark: '备注',
    trackRemark: '轨道备注',
    status: '状态',
    hasReworkReason: '是否含返工原因',
    importCount: '导入次数',
    lastImportTime: '最后导入时间',
    reviewStatus: '复核状态',
    reviewComment: '复核意见',
    trackName: '曲目名称',
    aliasName: '别名',
  };
  return fieldMap[fieldName] || fieldName;
}
