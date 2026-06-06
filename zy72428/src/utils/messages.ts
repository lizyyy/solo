import { v4 as uuidv4 } from 'uuid';
import { UserMessage } from '../types';

export function createInfoMessage(message: string, suggestion?: string): UserMessage {
  return {
    id: uuidv4(),
    level: 'info',
    message,
    suggestion,
    timestamp: new Date(),
  };
}

export function createWarningMessage(message: string, suggestion?: string): UserMessage {
  return {
    id: uuidv4(),
    level: 'warning',
    message,
    suggestion,
    timestamp: new Date(),
  };
}

export function createErrorMessage(message: string, suggestion?: string): UserMessage {
  return {
    id: uuidv4(),
    level: 'error',
    message,
    suggestion,
    timestamp: new Date(),
  };
}

export const ErrorMessages = {
  duplicateImport: (count: number) => ({
    message: `发现 ${count} 条重复导入的排班记录`,
    suggestion: '请检查导入批次，确认是否需要去重后重新导入，或手动确认这些重复记录是否有效',
  }),

  leaveCountedAsConsumed: (performerName: string, date: string) => ({
    message: `${performerName} 在 ${date} 的请假课时被误算为已消耗`,
    suggestion: '请标记为请假课时，不要计入已消耗课时，已自动标记为待巡演统筹复核',
  }),

  trackNameMismatch: (photoName: string, aliasName: string) => ({
    message: `曲目名称不一致：签到照片显示"${photoName}"，曲目别名表对应"${aliasName}"`,
    suggestion: '请核对原始材料，点击"确认"以别名表为准，或"驳回"保留照片记录',
  }),

  supplementRecalculateNeeded: () => ({
    message: '检测到补录材料，需要重新计算课时消耗',
    suggestion: '系统将自动重算，请确认重算结果是否正确',
  }),

  exportInconsistent: () => ({
    message: '导出数据与内部记录不一致',
    suggestion: '请不要手动修改导出文件，如有需要请在系统内调整后重新导出',
  }),

  missingCanonicalName: (trackName: string) => ({
    message: `曲目"${trackName}"未在别名表中找到标准名称`,
    suggestion: '请先补充曲目别名表，或手动指定标准名称',
  }),

  coordinatorReviewRequired: (count: number) => ({
    message: `有 ${count} 条请假课时记录需要巡演统筹复核`,
    suggestion: '请联系巡演统筹确认这些记录是否确认为请假，不要直接计入正常课时',
  }),
};
