import { DataStore } from '../services/dataStore';
import { logger } from '../utils/logger';
import { ManualCorrection } from '../models';

interface CorrectOptions {
  type: string;
  appointmentId?: string;
  batchNumber?: string;
  reason: string;
  operator: string;
  original?: string;
  corrected?: string;
}

export function handleCorrect(
  date: string,
  options: CorrectOptions,
  store: DataStore
): void {
  try {
    logger.heading(`人工修正`);

    const type = options.type as ManualCorrection['type'];
    const validTypes: ManualCorrection['type'][] = ['dose_adjustment', 'refund_confirm', 'batch_merge', 'other'];
    
    if (!validTypes.includes(type)) {
      logger.error(`无效的修正类型: ${type}`);
      logger.info(`有效类型: ${validTypes.join(', ')}`);
      process.exit(1);
    }

    if (options.appointmentId && !store.getAppointment(options.appointmentId)) {
      logger.error(`预约号不存在: ${options.appointmentId}`);
      process.exit(1);
    }

    if (options.batchNumber && !store.getBatch(options.batchNumber)) {
      logger.error(`药剂批号不存在: ${options.batchNumber}`);
      process.exit(1);
    }

    const correction = store.addManualCorrection({
      date,
      type,
      appointmentId: options.appointmentId,
      batchNumber: options.batchNumber,
      reason: options.reason,
      originalValue: options.original,
      correctedValue: options.corrected,
      operator: options.operator
    });

    logger.success(`修正记录已添加`);
    logger.line();
    logger.info(`修正详情:`);
    logger.bullet(`ID: ${correction.id}`);
    logger.bullet(`日期: ${correction.date}`);
    logger.bullet(`类型: ${formatType(correction.type)}`);
    if (correction.appointmentId) {
      logger.bullet(`预约号: ${correction.appointmentId}`);
    }
    if (correction.batchNumber) {
      logger.bullet(`批号: ${correction.batchNumber}`);
    }
    logger.bullet(`原因: ${correction.reason}`);
    if (correction.originalValue) {
      logger.bullet(`原值: ${correction.originalValue}`);
    }
    if (correction.correctedValue) {
      logger.bullet(`修正值: ${correction.correctedValue}`);
    }
    logger.bullet(`操作人: ${correction.operator}`);

  } catch (e: any) {
    logger.error(`修正失败: ${e.message}`);
    process.exit(1);
  }
}

function formatType(type: string): string {
  const typeMap: Record<string, string> = {
    dose_adjustment: '剂量调整',
    refund_confirm: '退费确认',
    batch_merge: '批次合并',
    other: '其他'
  };
  return typeMap[type] || type;
}
