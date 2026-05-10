import { DataStore } from '../services/dataStore';
import { Reconciler } from '../services/reconciler';
import { logger } from '../utils/logger';

export function handlePending(date: string, store: DataStore): void {
  try {
    logger.heading(`待处理项 - ${date}`);

    const reconciler = new Reconciler(store);
    const pendingItems = reconciler.getPendingItems(date);

    if (pendingItems.length === 0) {
      logger.success(`没有待处理项`);
      return;
    }

    logger.warning(`发现 ${pendingItems.length} 个待处理项:`);
    logger.line();

    const rows = pendingItems.map(item => [
      item.appointment.appointmentId,
      item.appointment.patientName,
      item.appointment.contrastAgent,
      `${item.plannedDose}ml`,
      item.status === 'missing_usage' ? '缺少用药' : '待确认',
      item.issues[0]?.message || ''
    ]);

    logger.table(
      ['预约号', '患者', '药剂', '计划剂量', '状态', '说明'],
      rows
    );

    logger.line();
    logger.info(`建议:`);
    logger.bullet('1. 检查开瓶记录是否完整');
    logger.bullet('2. 确认患者是否已完成检查');
    logger.bullet('3. 如需标记人工修正，请使用 correct 命令');

  } catch (e: any) {
    logger.error(`查询失败: ${e.message}`);
    process.exit(1);
  }
}
