import type { ChangeDetail, ChangeType, VersionHistory, ShortageRecord, Attachment } from '../types';

const CONCLUSION_FIELDS = ['amount', 'status', 'conclusion', 'issueCategory'];
const MATERIAL_FIELDS = ['attachments', 'sourceRef'];

export function determineChangeType(field: string): ChangeType {
  if (CONCLUSION_FIELDS.includes(field)) {
    return 'conclusion_changed';
  }
  if (MATERIAL_FIELDS.includes(field)) {
    return 'material_only';
  }
  return 'material_only';
}

export function compareVersions(
  oldRecord: Partial<ShortageRecord>,
  newRecord: Partial<ShortageRecord>
): ChangeDetail[] {
  const changes: ChangeDetail[] = [];
  const allFields = [...new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)])];

  for (const field of allFields) {
    const oldVal = oldRecord[field as keyof ShortageRecord];
    const newVal = newRecord[field as keyof ShortageRecord];

    if (field === 'attachments') {
      const attachChanges = compareAttachments(
        oldVal as Attachment[] | undefined,
        newVal as Attachment[] | undefined
      );
      changes.push(...attachChanges);
      continue;
    }

    const oldStr = String(oldVal ?? '');
    const newStr = String(newVal ?? '');

    if (oldStr !== newStr) {
      changes.push({
        field,
        oldValue: oldStr,
        newValue: newStr,
        changeType: determineChangeType(field)
      });
    }
  }

  return changes;
}

export function compareAttachments(
  oldAttachments: Attachment[] = [],
  newAttachments: Attachment[] = []
): ChangeDetail[] {
  const changes: ChangeDetail[] = [];
  const oldMap = new Map(oldAttachments.map(a => [a.name, a]));
  const newMap = new Map(newAttachments.map(a => [a.name, a]));

  for (const [name, newAtt] of newMap) {
    const oldAtt = oldMap.get(name);
    if (!oldAtt) {
      changes.push({
        field: `attachment:${name}`,
        oldValue: '(无)',
        newValue: `新增附件 v${newAtt.version}`,
        changeType: 'material_only'
      });
    } else if (oldAtt.version !== newAtt.version || oldAtt.fileHash !== newAtt.fileHash) {
      if (oldAtt.version > newAtt.version) {
        changes.push({
          field: `attachment:${name}`,
          oldValue: `v${oldAtt.version}`,
          newValue: `v${newAtt.version} (旧版本回传！)`,
          changeType: 'conclusion_changed'
        });
      } else {
        changes.push({
          field: `attachment:${name}`,
          oldValue: `v${oldAtt.version}`,
          newValue: `v${newAtt.version}`,
          changeType: 'material_only'
        });
      }
    }
  }

  return changes;
}

export function hasConclusionChanges(changes: ChangeDetail[]): boolean {
  return changes.some(c => c.changeType === 'conclusion_changed');
}

export function hasMaterialOnlyChanges(changes: ChangeDetail[]): boolean {
  return changes.every(c => c.changeType === 'material_only');
}

export function detectOldVersionAttachment(
  existingAttachments: Attachment[],
  newAttachment: Attachment
): { isOld: boolean; message: string } {
  const existing = existingAttachments.find(a => a.name === newAttachment.name);
  if (!existing) {
    return { isOld: false, message: '新增附件' };
  }
  if (newAttachment.version < existing.version) {
    return {
      isOld: true,
      message: `警告：附件"${newAttachment.name}"版本回传！现有v${existing.version}，新上传v${newAttachment.version}`
    };
  }
  if (newAttachment.version === existing.version && newAttachment.fileHash !== existing.fileHash) {
    return {
      isOld: true,
      message: `警告：附件"${newAttachment.name}"相同版本但内容变更！可能覆盖前一次判断`
    };
  }
  return { isOld: false, message: '附件更新' };
}

export function findPreviousVersion(
  history: VersionHistory[],
  currentVersion: number
): VersionHistory | undefined {
  return history.find(h => h.version === currentVersion - 1);
}
