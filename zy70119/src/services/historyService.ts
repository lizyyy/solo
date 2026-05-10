import db from '../database';
import { StatusHistory, StatusType, OfflineReason, SourceType, HistoryQueryResult } from '../types';
import { generateId, now, statusDesc, reasonDesc, sourceDesc, formatBusinessTime } from '../utils/business';

export const historyService = {
  recordChange: (
    storeId: string,
    itemId: string,
    channelId: string,
    previousStatus: StatusType | null,
    newStatus: StatusType,
    reason: OfflineReason | null,
    source: SourceType,
    operator: string,
    remark: string = '',
    relatedTaskId: string | null = null
  ): string => {
    const record: StatusHistory = {
      id: generateId('hist'),
      storeId,
      itemId,
      channelId,
      previousStatus,
      newStatus,
      reason,
      source,
      operator,
      remark,
      timestamp: now(),
      relatedTaskId
    };
    db.addStatusHistory(record);
    return record.id;
  },

  queryHistory: (
    storeId?: string,
    itemId?: string,
    channelId?: string,
    startTime?: string,
    endTime?: string,
    source?: SourceType
  ): HistoryQueryResult => {
    let records = [...db.statusHistory];

    if (storeId) records = records.filter(r => r.storeId === storeId);
    if (itemId) records = records.filter(r => r.itemId === itemId);
    if (channelId) records = records.filter(r => r.channelId === channelId);
    if (startTime) records = records.filter(r => r.timestamp >= startTime);
    if (endTime) records = records.filter(r => r.timestamp <= endTime);
    if (source) records = records.filter(r => r.source === source);

    records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const autoChanges = records.filter(r => r.source === SourceType.AUTO).length;
    const manualChanges = records.filter(r => r.source === SourceType.MANUAL).length;
    const onlineCount = records.filter(r => r.newStatus === StatusType.ONLINE).length;
    const offlineCount = records.filter(r => r.newStatus === StatusType.OFFLINE || r.newStatus === StatusType.SUSPENDED).length;

    return {
      records,
      summary: {
        total: records.length,
        autoChanges,
        manualChanges,
        onlineCount,
        offlineCount
      }
    };
  },

  formatHistoryRecord: (record: StatusHistory, storeName: string, itemName: string, channelName: string) => {
    return {
      记录ID: record.id,
      门店: storeName,
      商品: itemName,
      渠道: channelName,
      操作类型: sourceDesc[record.source],
      变更前状态: record.previousStatus ? statusDesc[record.previousStatus] : '-',
      变更后状态: statusDesc[record.newStatus],
      下架原因: record.reason ? reasonDesc[record.reason] : '-',
      操作人: record.operator,
      备注: record.remark || '-',
      操作时间: formatBusinessTime(record.timestamp),
      关联任务: record.relatedTaskId || '-'
    };
  }
};

export default historyService;
