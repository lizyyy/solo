import { ParentSubscription } from '../models/types';
import { repository } from '../repositories/MemoryRepository';
import { lineService } from './LineService';
import { detourService, CreateDetourRequest } from './DetourService';
import { etaService, CreateEtaRequest } from './EtaService';
import { notificationService, CreateNotificationRequest } from './NotificationService';
import { receiptService } from './ReceiptService';
import { reportService } from './ReportService';
import { BusinessError, DetourConflictError } from '../models/errors';

export class BusNotificationFacade {
  subscribeParent(
    parentId: string,
    lineId: string,
    stopId: string,
    childName: string
  ): ParentSubscription {
    const subscription: ParentSubscription = {
      parentId,
      lineId,
      stopId,
      childName,
      isActive: true,
    };
    return repository.saveSubscription(subscription);
  }

  async reportDetour(request: CreateDetourRequest): Promise<{
    eventId: string;
    notificationsCreated: number;
    receiptsCreated: number;
  }> {
    let event;
    let conflicted = false;
    
    try {
      event = detourService.createDetour(request);
    } catch (error) {
      if (error instanceof DetourConflictError) {
        event = detourService.getDetour(request.lineId + '-conflict');
        if (!event) {
          throw error;
        }
        conflicted = true;
      } else {
        throw error;
      }
    }

    if (!event) {
      throw new Error('创建绕行事件失败');
    }

    let notificationsCreated = 0;
    let receiptsCreated = 0;

    if (!conflicted) {
      detourService.activateDetour(event.id);

      const subscriptions = repository.findSubscriptionsByLine(request.lineId);
      const affectedSubscriptions = subscriptions.filter((s) =>
        event!.affectedStopIds.includes(s.stopId)
      );

      for (const sub of affectedSubscriptions) {
        const notificationRequest: CreateNotificationRequest = {
          parentId: sub.parentId,
          lineId: request.lineId,
          stopId: sub.stopId,
          type: 'DETOUR_START',
          detourEventId: event!.id,
        };
        const notification = notificationService.createNotification(notificationRequest);
        if (notification) {
          notificationsCreated++;
        }
      }

      const defaultDriverId = 'driver-' + request.lineId;
      receiptService.createReceipt(defaultDriverId, event.id);
      receiptsCreated = 1;
    }

    return {
      eventId: event.id,
      notificationsCreated,
      receiptsCreated,
    };
  }

  async updateEtaForDetour(
    lineId: string,
    detourEventId: string,
    stopId: string,
    estimatedArrival: Date
  ): Promise<boolean> {
    const detour = detourService.getDetour(detourEventId);
    if (!detour || detour.status !== 'ACTIVE') {
      return false;
    }

    const etaRequest: CreateEtaRequest = {
      lineId,
      stopId,
      estimatedArrival,
      source: 'DETOUR',
      detourEventId,
    };

    const eta = etaService.createEta(etaRequest);
    if (!eta) {
      return false;
    }

    const subscriptions = repository.findSubscriptionsByLineAndStop(lineId, stopId);
    for (const sub of subscriptions) {
      notificationService.createNotification({
        parentId: sub.parentId,
        lineId,
        stopId,
        type: 'ETA_UPDATE',
        detourEventId,
      });
    }

    return true;
  }

  async resolveDetour(eventId: string): Promise<{
    resolved: boolean;
    notificationsCreated: number;
  }> {
    const detour = detourService.getDetour(eventId);
    if (!detour) {
      return { resolved: false, notificationsCreated: 0 };
    }

    detourService.resolveDetour(eventId);

    let notificationsCreated = 0;
    const subscriptions = repository.findSubscriptionsByLine(detour.lineId);
    const affectedSubscriptions = subscriptions.filter((s) =>
      detour.affectedStopIds.includes(s.stopId)
    );

    for (const sub of affectedSubscriptions) {
      const notification = notificationService.createNotification({
        parentId: sub.parentId,
        lineId: detour.lineId,
        stopId: sub.stopId,
        type: 'DETOUR_END',
        detourEventId: eventId,
      });
      if (notification) {
        notificationsCreated++;
      }
    }

    return { resolved: true, notificationsCreated };
  }

  async cancelDetour(eventId: string, reason?: string): Promise<{
    cancelled: boolean;
    notificationsCreated: number;
  }> {
    const detour = detourService.getDetour(eventId);
    if (!detour) {
      return { cancelled: false, notificationsCreated: 0 };
    }

    if (detour.status === 'RESOLVED' || detour.status === 'CANCELLED') {
      return { cancelled: false, notificationsCreated: 0 };
    }

    detourService.cancelDetour(eventId, reason);

    let notificationsCreated = 0;
    const subscriptions = repository.findSubscriptionsByLine(detour.lineId);
    const affectedSubscriptions = subscriptions.filter((s) =>
      detour.affectedStopIds.includes(s.stopId)
    );

    for (const sub of affectedSubscriptions) {
      const notification = notificationService.createNotification({
        parentId: sub.parentId,
        lineId: detour.lineId,
        stopId: sub.stopId,
        type: 'DETOUR_CANCELLED',
        detourEventId: eventId,
      });
      if (notification) {
        notificationsCreated++;
      }
    }

    return { cancelled: true, notificationsCreated };
  }

  recordActualArrival(lineId: string, stopId: string): void {
    etaService.recordActualArrival(lineId, stopId);
  }

  acknowledgeReceipt(receiptId: string): void {
    receiptService.acknowledgeReceipt(receiptId);
  }

  rejectReceipt(receiptId: string, reason: string): void {
    receiptService.rejectReceipt(receiptId, reason);
  }

  processExpiredReceipts(): number {
    const expired = receiptService.processExpiredReceipts();
    return expired.length;
  }

  async processNotifications(
    sendFn?: (content: string) => Promise<boolean>
  ): Promise<number> {
    const results = await notificationService.processPendingNotifications(sendFn);
    return results.filter((n) => n.status === 'SENT').length;
  }

  getParentNotifications(parentId: string) {
    return notificationService.getNotificationsByParent(parentId);
  }

  getRunReport(lineId: string, date?: string) {
    return reportService.generateRunReport(lineId, date);
  }

  getSystemStatus(lineId: string) {
    return reportService.getDetailedSummary(lineId);
  }

  getDetourStatus(eventId: string) {
    const detour = detourService.getDetour(eventId);
    if (!detour) {
      return null;
    }

    const receiptStats = receiptService.getStatistics(eventId);
    const etas = etaService.getEtasByDetour(eventId);

    return {
      detour,
      receiptStats,
      etaCount: etas.length,
      allAcknowledged: receiptService.isAllAcknowledged(eventId),
    };
  }
}

export const busFacade = new BusNotificationFacade();
