import { Notification, NotificationStatus } from '../models/types';
import { repository } from '../repositories/MemoryRepository';
import { lineService } from './LineService';
import { detourService } from './DetourService';
import { MaxRetriesExceededError } from '../models/errors';

export type NotificationType = 'ETA_UPDATE' | 'DETOUR_START' | 'DETOUR_END' | 'DETOUR_CANCELLED';

export interface CreateNotificationRequest {
  parentId: string;
  lineId: string;
  stopId: string;
  type: NotificationType;
  detourEventId?: string;
  content?: string;
}

export class NotificationService {
  private readonly DEDUPLICATION_WINDOW_MINUTES = 5;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MINUTES = [1, 5, 15];

  createNotification(request: CreateNotificationRequest): Notification | null {
    const deduplicationKey = this.generateDeduplicationKey(request);
    const existingNotifications = repository.findNotificationsByDeduplicationKey(deduplicationKey);
    
    const windowStart = new Date(Date.now() - this.DEDUPLICATION_WINDOW_MINUTES * 60 * 1000);
    const recentNotifications = existingNotifications.filter(
      (n) => n.createdAt >= windowStart && n.status !== 'CANCELLED'
    );

    if (recentNotifications.length > 0) {
      return null;
    }

    const content = request.content ?? this.generateContent(request);

    const notification: Notification = {
      id: repository.generateId(),
      parentId: request.parentId,
      stopId: request.stopId,
      lineId: request.lineId,
      detourEventId: request.detourEventId,
      type: request.type,
      content,
      deduplicationKey,
      status: 'PENDING',
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      createdAt: new Date(),
    };

    return repository.saveNotification(notification);
  }

  private generateDeduplicationKey(request: CreateNotificationRequest): string {
    const typePart = request.type;
    const stopPart = request.stopId;
    const detourPart = request.detourEventId ?? 'none';
    const timeWindow = Math.floor(Date.now() / (this.DEDUPLICATION_WINDOW_MINUTES * 60 * 1000));
    
    return `${request.parentId}:${typePart}:${stopPart}:${detourPart}:${timeWindow}`;
  }

  private generateContent(request: CreateNotificationRequest): string {
    const stopName = lineService.getStopName(request.lineId, request.stopId);
    const lineVersion = lineService.getActiveLineVersion(request.lineId);

    switch (request.type) {
      case 'DETOUR_START':
        if (request.detourEventId) {
          const detour = detourService.getDetour(request.detourEventId);
          if (detour) {
            const altStops = detour.alternativeStopIds
              .map((id) => lineService.getStopName(request.lineId, id))
              .join('、');
            return `【${lineVersion.lineName}】因${detour.description}，${stopName}站临时绕行，请前往${altStops}候车。`;
          }
        }
        return `【${lineVersion.lineName}】${stopName}站临时绕行，请留意更新。`;

      case 'DETOUR_END':
        return `【${lineVersion.lineName}】${stopName}站绕行已结束，恢复正常运行。`;

      case 'DETOUR_CANCELLED':
        return `【${lineVersion.lineName}】${stopName}站的绕行计划已撤销，将按原线路运行。`;

      case 'ETA_UPDATE':
      default:
        const eta = repository.findLatestEta(request.stopId, request.lineId);
        if (eta) {
          const timeStr = eta.estimatedArrival.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
          const sourceStr = eta.source === 'DETOUR' ? '（绕行后）' : '';
          return `【${lineVersion.lineName}】${stopName}站预计${timeStr}到达${sourceStr}。`;
        }
        return `【${lineVersion.lineName}】${stopName}站到达时间已更新。`;
    }
  }

  sendNotification(notificationId: string, sendFn?: (content: string) => Promise<boolean>): Promise<Notification> {
    const notification = repository.findNotificationById(notificationId);
    if (!notification) {
      throw new Error(`通知 ${notificationId} 不存在`);
    }

    if (notification.status === 'SENT' || notification.status === 'CANCELLED') {
      return Promise.resolve(notification);
    }

    if (notification.retryCount >= notification.maxRetries) {
      throw new MaxRetriesExceededError(notificationId, notification.maxRetries);
    }

    const actualSendFn = sendFn ?? this.defaultSendFn;

    return actualSendFn(notification.content)
      .then((success) => {
        if (success) {
          notification.status = 'SENT';
          notification.sentAt = new Date();
        } else {
          this.handleFailure(notification);
        }
        return repository.saveNotification(notification);
      })
      .catch(() => {
        this.handleFailure(notification);
        return repository.saveNotification(notification);
      });
  }

  private handleFailure(notification: Notification): void {
    notification.retryCount++;
    notification.status = 'FAILED';

    if (notification.retryCount < notification.maxRetries) {
      const delayMinutes = this.RETRY_DELAY_MINUTES[notification.retryCount - 1] ?? 
                          this.RETRY_DELAY_MINUTES[this.RETRY_DELAY_MINUTES.length - 1];
      notification.nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    }
  }

  private defaultSendFn(_content: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  processPendingNotifications(sendFn?: (content: string) => Promise<boolean>): Promise<Notification[]> {
    const pending = repository.findPendingNotifications();
    return Promise.all(
      pending.map((n) => this.sendNotification(n.id, sendFn))
    );
  }

  cancelNotification(notificationId: string): Notification {
    const notification = repository.findNotificationById(notificationId);
    if (!notification) {
      throw new Error(`通知 ${notificationId} 不存在`);
    }

    if (notification.status === 'PENDING' || notification.status === 'FAILED') {
      notification.status = 'CANCELLED';
      return repository.saveNotification(notification);
    }

    return notification;
  }

  getNotificationsByParent(parentId: string): Notification[] {
    return repository.findNotificationsByParent(parentId);
  }

  getNotification(id: string): Notification | undefined {
    return repository.findNotificationById(id);
  }

  getStatistics(): {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    deduplicated: number;
  } {
    const all = repository.getAllNotifications();
    return {
      total: all.length,
      sent: all.filter((n) => n.status === 'SENT').length,
      failed: all.filter((n) => n.status === 'FAILED' && n.retryCount >= n.maxRetries).length,
      pending: all.filter((n) => n.status === 'PENDING' || (n.status === 'FAILED' && n.retryCount < n.maxRetries)).length,
      deduplicated: 0,
    };
  }
}

export const notificationService = new NotificationService();
