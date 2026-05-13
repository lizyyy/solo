import { store } from '../database/store';
import {
  VisitorRecord,
  HostConfirmation,
  PlateEntry,
  AccessQRCode,
  CheckoutRecord,
  BlacklistRecord,
  OperationLog,
  VisitorStatus,
  OperationType,
  TimelineEvent
} from '../../shared/types';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

class VisitorService {
  createVisitor(data: Omit<VisitorRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'>, operator: string, operatorRole: string): VisitorRecord {
    const blacklistRecord = store.getBlacklistByPhone(data.visitorPhone);
    if (blacklistRecord) {
      throw new Error('该访客在黑名单中，无法创建预约');
    }

    if (data.visitorIdCard) {
      const idCardBlacklist = store.getBlacklistByIdCard(data.visitorIdCard);
      if (idCardBlacklist) {
        throw new Error('该访客在黑名单中，无法创建预约');
      }
    }

    const visitor = store.addVisitor({
      ...data,
      status: VisitorStatus.PENDING_HOST_CONFIRM
    });

    store.addOperationLog({
      visitorId: visitor.id,
      operationType: OperationType.CREATE,
      operator,
      operatorRole,
      description: '创建访客预约',
      afterValue: visitor
    });

    return visitor;
  }

  hostConfirm(visitorId: string, confirmed: boolean, operator: string, operatorRole: string, rejectReason?: string): HostConfirmation {
    const visitor = store.getVisitor(visitorId);
    if (!visitor) {
      throw new Error('访客记录不存在');
    }

    if (visitor.status !== VisitorStatus.PENDING_HOST_CONFIRM) {
      throw new Error('当前状态不允许被访人确认');
    }

    const confirmation = store.addHostConfirmation({
      visitorId,
      confirmed,
      confirmTime: confirmed ? dayjs().toISOString() : undefined,
      rejectReason: !confirmed ? rejectReason : undefined,
      operator
    });

    const newStatus = confirmed ? VisitorStatus.HOST_CONFIRMED : VisitorStatus.HOST_REJECTED;
    store.updateVisitor(visitorId, { status: newStatus });

    store.addOperationLog({
      visitorId,
      operationType: confirmed ? OperationType.CONFIRM : OperationType.REJECT,
      operator,
      operatorRole,
      description: confirmed ? '被访人确认同意' : `被访人拒绝：${rejectReason}`,
      beforeValue: { status: visitor.status },
      afterValue: { status: newStatus, confirmation }
    });

    return confirmation;
  }

  verifyPlateEntry(visitorId: string, plateNumber: string, operator: string, operatorRole: string): PlateEntry {
    const visitor = store.getVisitor(visitorId);
    if (!visitor) {
      throw new Error('访客记录不存在');
    }

    if (visitor.status === VisitorStatus.HOST_REJECTED) {
      throw new Error('被访人已拒绝，无法入园');
    }

    if (visitor.status === VisitorStatus.BLOCKED) {
      throw new Error('访客已被拦截，无法入园');
    }

    if (visitor.status !== VisitorStatus.HOST_CONFIRMED && visitor.status !== VisitorStatus.MANUAL_REVIEW) {
      throw new Error('当前状态不允许车牌入园');
    }

    const blacklistRecord = store.getBlacklistByPhone(visitor.visitorPhone);
    if (blacklistRecord) {
      store.updateVisitor(visitorId, { status: VisitorStatus.BLOCKED });
      throw new Error('该访客在黑名单中，已被拦截');
    }

    const existingEntries = store.getPlateEntriesByVisitor(visitorId);
    if (existingEntries.some(e => e.verified)) {
      throw new Error('该访客已入园，请勿重复提交');
    }

    const plateMatched = visitor.visitorPlate && 
      visitor.visitorPlate.toUpperCase() === plateNumber.toUpperCase();

    if (!plateMatched) {
      const entry = store.addPlateEntry({
        visitorId,
        plateNumber,
        verified: false,
        rejectReason: '车牌不匹配，需人工复核',
        operator
      });
      store.updateVisitor(visitorId, { status: VisitorStatus.MANUAL_REVIEW });

      store.addOperationLog({
        visitorId,
        operationType: OperationType.CHECK_IN,
        operator,
        operatorRole,
        description: '车牌不匹配，进入人工复核',
        beforeValue: { status: visitor.status },
        afterValue: { status: VisitorStatus.MANUAL_REVIEW, plateEntry: entry }
      });

      return entry;
    }

    const entry = store.addPlateEntry({
      visitorId,
      plateNumber,
      verified: true,
      entryTime: dayjs().toISOString(),
      operator
    });

    store.updateVisitor(visitorId, { status: VisitorStatus.PLATE_ENTERED });

    store.addOperationLog({
      visitorId,
      operationType: OperationType.CHECK_IN,
      operator,
      operatorRole,
      description: '车牌校验通过，成功入园',
      beforeValue: { status: visitor.status },
      afterValue: { status: VisitorStatus.PLATE_ENTERED, plateEntry: entry }
    });

    return entry;
  }

  scanQRCode(visitorId: string, qrcode: string, operator: string, operatorRole: string): AccessQRCode {
    const visitor = store.getVisitor(visitorId);
    if (!visitor) {
      throw new Error('访客记录不存在');
    }

    if (visitor.status !== VisitorStatus.PLATE_ENTERED) {
      throw new Error('当前状态不允许扫描二维码');
    }

    const existingQRCodes = store.getQRCodesByVisitor(visitorId);
    if (existingQRCodes.some(q => q.scanned)) {
      throw new Error('该访客二维码已扫描，请勿重复提交');
    }

    const validQRCode = existingQRCodes.find(q => q.qrcode === qrcode && !q.scanned);
    if (!validQRCode) {
      throw new Error('无效的二维码');
    }

    if (dayjs().isAfter(dayjs(validQRCode.expireTime))) {
      throw new Error('二维码已过期');
    }

    store.updateQRCode(validQRCode.id, {
      scanned: true,
      scanTime: dayjs().toISOString()
    });

    store.updateVisitor(visitorId, { status: VisitorStatus.QRCODE_SCANNED });

    store.addOperationLog({
      visitorId,
      operationType: OperationType.CHECK_IN,
      operator,
      operatorRole,
      description: '门禁二维码扫描成功',
      beforeValue: { status: visitor.status },
      afterValue: { status: VisitorStatus.QRCODE_SCANNED }
    });

    return { ...validQRCode, scanned: true, scanTime: dayjs().toISOString() };
  }

  generateQRCode(visitorId: string, operator: string, operatorRole: string): AccessQRCode {
    const visitor = store.getVisitor(visitorId);
    if (!visitor) {
      throw new Error('访客记录不存在');
    }

    if (visitor.status !== VisitorStatus.HOST_CONFIRMED && visitor.status !== VisitorStatus.MANUAL_REVIEW) {
      throw new Error('当前状态不允许生成二维码');
    }

    const qrcode = store.addQRCode({
      visitorId,
      qrcode: `QR-${uuidv4().substring(0, 8).toUpperCase()}`,
      scanned: false,
      expireTime: dayjs().add(24, 'hour').toISOString(),
      operator
    });

    store.addOperationLog({
      visitorId,
      operationType: OperationType.CREATE,
      operator,
      operatorRole,
      description: '生成门禁二维码',
      afterValue: qrcode
    });

    return qrcode;
  }

  checkout(visitorId: string, checkoutType: 'auto' | 'manual', operator: string, operatorRole: string): CheckoutRecord {
    const visitor = store.getVisitor(visitorId);
    if (!visitor) {
      throw new Error('访客记录不存在');
    }

    const existingCheckouts = store.getCheckoutRecordsByVisitor(visitorId);
    if (existingCheckouts.some(c => !c.blocked)) {
      throw new Error('该访客已离园，请勿重复提交');
    }

    if (visitor.status === VisitorStatus.BLOCKED) {
      const checkoutRecord = store.addCheckoutRecord({
        visitorId,
        checkoutTime: dayjs().toISOString(),
        checkoutType,
        operator: checkoutType === 'manual' ? operator : undefined,
        blocked: true,
        blockReason: '访客处于被拦截状态'
      });

      store.addOperationLog({
        visitorId,
        operationType: OperationType.CHECK_OUT,
        operator,
        operatorRole,
        description: '离园核销被拦截：访客处于被拦截状态',
        afterValue: checkoutRecord
      });

      return checkoutRecord;
    }

    if (visitor.status !== VisitorStatus.QRCODE_SCANNED && visitor.status !== VisitorStatus.MANUAL_REVIEW) {
      const checkoutRecord = store.addCheckoutRecord({
        visitorId,
        checkoutTime: dayjs().toISOString(),
        checkoutType,
        operator: checkoutType === 'manual' ? operator : undefined,
        blocked: true,
        blockReason: '当前状态不允许离园'
      });

      store.addOperationLog({
        visitorId,
        operationType: OperationType.CHECK_OUT,
        operator,
        operatorRole,
        description: '离园核销被拦截：当前状态不允许离园',
        afterValue: checkoutRecord
      });

      return checkoutRecord;
    }

    const checkoutRecord = store.addCheckoutRecord({
      visitorId,
      checkoutTime: dayjs().toISOString(),
      checkoutType,
      operator: checkoutType === 'manual' ? operator : undefined,
      blocked: false
    });

    store.updateVisitor(visitorId, { status: VisitorStatus.COMPLETED });

    const plateEntries = store.getPlateEntriesByVisitor(visitorId);
    if (plateEntries.length > 0) {
      store.updatePlateEntry(plateEntries[0].id, {
        exitTime: dayjs().toISOString()
      });
    }

    store.addOperationLog({
      visitorId,
      operationType: OperationType.CHECK_OUT,
      operator,
      operatorRole,
      description: '离园核销成功',
      beforeValue: { status: visitor.status },
      afterValue: { status: VisitorStatus.COMPLETED, checkoutRecord }
    });

    return checkoutRecord;
  }

  manualReview(visitorId: string, approved: boolean, operator: string, operatorRole: string, reason?: string): VisitorRecord {
    const visitor = store.getVisitor(visitorId);
    if (!visitor) {
      throw new Error('访客记录不存在');
    }

    if (visitor.status !== VisitorStatus.MANUAL_REVIEW) {
      throw new Error('当前状态不需要人工复核');
    }

    const newStatus = approved ? VisitorStatus.HOST_CONFIRMED : VisitorStatus.BLOCKED;
    const updatedVisitor = store.updateVisitor(visitorId, { status: newStatus })!;

    store.addOperationLog({
      visitorId,
      operationType: OperationType.MANUAL_REVIEW,
      operator,
      operatorRole,
      description: approved ? '人工复核通过' : `人工复核拒绝：${reason}`,
      beforeValue: { status: visitor.status },
      afterValue: { status: newStatus }
    });

    return updatedVisitor;
  }

  addToBlacklist(
    visitorName: string,
    visitorPhone: string,
    visitorIdCard: string | undefined,
    reason: string,
    addedBy: string,
    operatorRole: string
  ): BlacklistRecord {
    const affectedVisitors = store.getAllVisitors()
      .filter(v => v.visitorPhone === visitorPhone || (visitorIdCard && v.visitorIdCard === visitorIdCard))
      .map(v => v.id);

    const blacklistRecord = store.addBlacklistRecord({
      visitorName,
      visitorPhone,
      visitorIdCard,
      reason,
      addedBy,
      isActive: true,
      affectedRecords: affectedVisitors
    });

    affectedVisitors.forEach(visitorId => {
      const visitor = store.getVisitor(visitorId);
      if (visitor && visitor.status !== VisitorStatus.COMPLETED) {
        store.updateVisitor(visitorId, { status: VisitorStatus.BLOCKED });
      }
    });

    store.addOperationLog({
      operationType: OperationType.BLACKLIST_ADD,
      operator: addedBy,
      operatorRole,
      description: `添加黑名单：${visitorName}，原因：${reason}`,
      afterValue: blacklistRecord
    });

    return blacklistRecord;
  }

  removeFromBlacklist(id: string, removedBy: string, operatorRole: string, reason: string): BlacklistRecord | undefined {
    const record = store.updateBlacklistRecord(id, {
      isActive: false,
      removedBy,
      removedAt: dayjs().toISOString()
    });

    if (record) {
      store.addOperationLog({
        operationType: OperationType.BLACKLIST_REMOVE,
        operator: removedBy,
        operatorRole,
        description: `移除黑名单：${record.visitorName}，原因：${reason}`,
        beforeValue: { isActive: true },
        afterValue: { isActive: false }
      });
    }

    return record;
  }

  getTimeline(visitorId: string): TimelineEvent[] {
    const visitor = store.getVisitor(visitorId);
    if (!visitor) {
      throw new Error('访客记录不存在');
    }

    const events: TimelineEvent[] = [];

    events.push({
      time: visitor.createdAt,
      event: '创建访客预约',
      details: `访客：${visitor.visitorName}，被访人：${visitor.hostName}`
    });

    const hostConfirmations = store.getHostConfirmationsByVisitor(visitorId);
    hostConfirmations.forEach(c => {
      events.push({
        time: c.confirmTime || c.createdAt,
        event: c.confirmed ? '被访人确认同意' : '被访人拒绝',
        operator: c.operator,
        details: c.rejectReason
      });
    });

    const plateEntries = store.getPlateEntriesByVisitor(visitorId);
    plateEntries.forEach(e => {
      events.push({
        time: e.entryTime || e.createdAt,
        event: e.verified ? '车牌校验通过，成功入园' : '车牌校验失败',
        operator: e.operator,
        details: e.rejectReason || `车牌：${e.plateNumber}`
      });
    });

    const qrCodes = store.getQRCodesByVisitor(visitorId);
    qrCodes.forEach(q => {
      if (q.scanned) {
        events.push({
          time: q.scanTime!,
          event: '门禁二维码扫描成功',
          operator: q.operator
        });
      } else {
        events.push({
          time: q.createdAt,
          event: '生成门禁二维码',
          operator: q.operator,
          details: `二维码：${q.qrcode}`
        });
      }
    });

    const checkouts = store.getCheckoutRecordsByVisitor(visitorId);
    checkouts.forEach(c => {
      events.push({
        time: c.checkoutTime,
        event: c.blocked ? '离园核销被拦截' : '离园核销成功',
        operator: c.operator,
        details: c.blockReason
      });
    });

    return events.sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf());
  }

  generateSecurityReport(reportDate: string, generatedBy: string, operatorRole: string) {
    const visitors = store.getAllVisitors();
    const dayVisitors = visitors.filter(v => 
      dayjs(v.createdAt).isSame(dayjs(reportDate), 'day')
    );

    const totalVisitors = dayVisitors.length;
    const completedVisits = dayVisitors.filter(v => v.status === VisitorStatus.COMPLETED).length;
    const blockedVisits = dayVisitors.filter(v => v.status === VisitorStatus.BLOCKED).length;
    const manualReviews = dayVisitors.filter(v => v.status === VisitorStatus.MANUAL_REVIEW).length;
    const blacklistCount = store.getAllBlacklist().filter(b => b.isActive).length;
    const abnormalRecords = dayVisitors
      .filter(v => v.status === VisitorStatus.BLOCKED || v.status === VisitorStatus.MANUAL_REVIEW)
      .map(v => v.id);

    const report = store.addSecurityReport({
      reportDate,
      totalVisitors,
      completedVisits,
      blockedVisits,
      manualReviews,
      blacklistCount,
      abnormalRecords,
      generatedBy
    });

    store.addOperationLog({
      operationType: OperationType.CREATE,
      operator: generatedBy,
      operatorRole,
      description: `生成安保报表：${reportDate}`,
      afterValue: report
    });

    return report;
  }
}

export const visitorService = new VisitorService();
