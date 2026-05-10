import db from '../database';
import { StatusType, OfflineReason, SourceType, ChannelStatus, BusinessResponse } from '../types';
import { generateId, now, successResponse, errorResponse, statusDesc, reasonDesc, sourceDesc, formatBusinessTime } from '../utils/business';
import historyService from './historyService';

function findStatus(storeId: string, itemId: string, channelId: string): ChannelStatus | null {
  const found = db.channelStatuses.find(
    s => s.storeId === storeId && s.itemId === itemId && s.channelId === channelId
  );
  return found || null;
}

function findAllStatuses(storeId?: string, itemId?: string, channelId?: string): ChannelStatus[] {
  let result = [...db.channelStatuses];
  if (storeId) result = result.filter(s => s.storeId === storeId);
  if (itemId) result = result.filter(s => s.itemId === itemId);
  if (channelId) result = result.filter(s => s.channelId === channelId);
  return result;
}

export const channelStatusService = {
  getStatus: findStatus,
  getAllStatuses: findAllStatuses,

  changeStatus: (
    storeId: string,
    itemId: string,
    channelId: string,
    newStatus: StatusType,
    reason: OfflineReason | null,
    source: SourceType,
    operator: string,
    remark: string = '',
    relatedTaskId: string | null = null
  ): BusinessResponse => {
    const current = findStatus(storeId, itemId, channelId);
    const previousStatus = current?.status || null;

    if (previousStatus === newStatus) {
      return errorResponse(
        'WARN-001',
        `状态无需变更：当前已是「${statusDesc[newStatus]}」`
      );
    }

    try {
      if (current) {
        current.status = newStatus;
        current.lastChangeReason = reason;
        current.lastChangeSource = source;
        current.changedBy = operator;
        current.changedAt = now();
      } else {
        const newCs: ChannelStatus = {
          id: generateId('cs'),
          storeId,
          itemId,
          channelId,
          status: newStatus,
          lastChangeReason: reason,
          lastChangeSource: source,
          changedBy: operator,
          changedAt: now()
        };
        db.addChannelStatus(newCs);
      }
      db.save();

      historyService.recordChange(
        storeId, itemId, channelId,
        previousStatus, newStatus, reason, source,
        operator, remark, relatedTaskId
      );
      
      const action = newStatus === StatusType.ONLINE ? '上架' : 
                     newStatus === StatusType.OFFLINE ? '下架' : '临时停售';
      const sourceText = source === SourceType.AUTO ? '系统自动' : '人工';
      const reasonText = reason ? `，原因：${reasonDesc[reason]}` : '';
      
      const prevStatusText = previousStatus ? statusDesc[previousStatus as StatusType] : '无记录';
      
      return successResponse(
        `操作成功：${sourceText}${action}${reasonText}`,
        {
          门店ID: storeId,
          商品ID: itemId,
          渠道ID: channelId,
          变更前: prevStatusText,
          变更后: statusDesc[newStatus],
          操作人: operator,
          操作时间: formatBusinessTime(now())
        }
      );
    } catch (e: any) {
      return errorResponse('ERR-001', `状态变更失败：${e.message}`);
    }
  },

  manualOnline: (
    storeId: string,
    itemId: string,
    channelId: string,
    operator: string,
    remark: string = ''
  ): BusinessResponse => {
    return channelStatusService.changeStatus(
      storeId, itemId, channelId,
      StatusType.ONLINE,
      null,
      SourceType.MANUAL,
      operator,
      remark
    );
  },

  manualOffline: (
    storeId: string,
    itemId: string,
    channelId: string,
    reason: OfflineReason.MANUAL | OfflineReason.COMPLIANCE,
    operator: string,
    remark: string = ''
  ): BusinessResponse => {
    return channelStatusService.changeStatus(
      storeId, itemId, channelId,
      StatusType.OFFLINE,
      reason,
      SourceType.MANUAL,
      operator,
      remark
    );
  },

  formatStatus: (status: ChannelStatus, storeName: string, itemName: string, channelName: string) => {
    return {
      门店: storeName,
      商品: itemName,
      渠道: channelName,
      当前状态: statusDesc[status.status],
      最近变更来源: sourceDesc[status.lastChangeSource],
      下架原因: status.lastChangeReason ? reasonDesc[status.lastChangeReason] : '-',
      操作人: status.changedBy,
      变更时间: formatBusinessTime(status.changedAt)
    };
  }
};

export default channelStatusService;
