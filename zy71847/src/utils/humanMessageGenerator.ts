import { ImportConflict, HumanMessage, CableRecord, ConflictType } from '@/types';
import { SOURCE_TYPE_LABELS } from '@/types';
import { findSourceById } from '@/data/mockSources';
import { findPersonById } from '@/data/mockPersons';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function getConflictMessage(conflict: ImportConflict): HumanMessage {
  const sourceInfo = conflict.sourceInfo;
  const existingRecord = conflict.existingRecord;
  const contactPerson = conflict.contactPerson;
  const existingSource = existingRecord ? findSourceById(existingRecord.sourceId) : undefined;

  const messages: Record<ConflictType, HumanMessage> = {
    duplicate: {
      level: 'warning',
      title: '发现重复的线缆记录',
      description: `第 ${conflict.rowIndex + 1} 行的 ${conflict.incomingData.cableNo} 线缆在 ${conflict.incomingData.cabinet} 机柜已经存在记录`,
      reason: sourceInfo
        ? `这条新记录来自${SOURCE_TYPE_LABELS[sourceInfo.type]}「${sourceInfo.name}」，由 ${sourceInfo.uploader} 于 ${formatDate(sourceInfo.uploadDate)} 上传。原有记录${existingSource ? `来自${SOURCE_TYPE_LABELS[existingSource.type]}「${existingSource.name}」` : '已存在于系统中'}。`
        : '这条记录可能之前已经录入过系统。',
      nextSteps: [
        { text: '保留现有记录，跳过这条新数据', action: 'skip' },
        { text: '用新数据覆盖现有记录', action: 'overwrite' },
        { text: '合并两条记录的信息', action: 'merge' },
      ],
      contact: contactPerson,
    },
    coordinate_flipped: {
      level: 'error',
      title: '检测到坐标轴可能被翻转',
      description: `${conflict.incomingData.cableNo} 的坐标与已有记录符号完全相反`,
      reason: `上次导入时可能误操作翻转了Y轴方向，导致坐标全部变号。系统检测到起点 (${existingRecord?.startPoint.x}, ${existingRecord?.startPoint.y}) 与新数据 (${conflict.incomingData.startPoint?.x}, ${conflict.incomingData.startPoint?.y}) 符号相反。`,
      nextSteps: [
        { text: '自动修正坐标符号，恢复正确方向', action: 'fix_flipped' },
        { text: '保留当前坐标（确认是新走向）', action: 'keep' },
      ],
      contact: contactPerson,
    },
    invalid_data: {
      level: 'error',
      title: '数据格式不正确',
      description: `第 ${conflict.rowIndex + 1} 行的数据填写不完整`,
      reason: '请检查必填项是否都已填写，坐标值是否为有效数字。',
      nextSteps: [
        { text: '跳过这条数据', action: 'skip' },
        { text: '修改后重新导入', action: 'retry' },
      ],
    },
  };

  return messages[conflict.conflictType];
}

export function generateHumanMessage(conflict: ImportConflict): HumanMessage {
  const message = getConflictMessage(conflict);
  if (message.contact) {
    message.nextSteps.push({
      text: `联系 ${message.contact.name}（${message.contact.role}）确认`,
      action: 'contact',
    });
  }
  return message;
}

export function generateRollbackMessage(
  record: CableRecord,
  version: number,
  operator: string,
  operationDate: string
): HumanMessage {
  const owner = findPersonById(record.ownerId);
  return {
    level: 'warning',
    title: '确认撤回此修改',
    description: `将撤销 ${operator} 在 ${formatDate(operationDate)} 对 ${record.cableNo} 线缆的修改`,
    reason: '撤回后数据将恢复到版本 ' + version + '，此操作会被记录到操作日志中。',
    nextSteps: [
      { text: '确认撤回', action: 'confirm_rollback' },
      { text: '取消', action: 'cancel' },
    ],
    contact: owner,
  };
}

export function generateExportMessage(count: number, status?: string): HumanMessage {
  return {
    level: 'info',
    title: '准备导出巡检单',
    description: `将导出 ${count} 条记录${status ? `，状态：${status}` : ''}`,
    reason: '导出文件将按已确认、待补、人工修改分块展示，并附带处理口径说明。',
    nextSteps: [
      { text: '导出为 PDF', action: 'export_pdf' },
      { text: '导出为 Excel', action: 'export_excel' },
    ],
  };
}
