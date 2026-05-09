import { v4 as uuidv4 } from 'uuid';
import {
  LineVersion,
  DetourEvent,
  StopEta,
  Notification,
  DriverReceipt,
  RunReport,
  ParentSubscription,
} from '../models/types';

export class MemoryRepository {
  private lineVersions: Map<string, LineVersion> = new Map();
  private detourEvents: Map<string, DetourEvent> = new Map();
  private stopEtas: Map<string, StopEta> = new Map();
  private notifications: Map<string, Notification> = new Map();
  private driverReceipts: Map<string, DriverReceipt> = new Map();
  private runReports: Map<string, RunReport> = new Map();
  private subscriptions: Map<string, ParentSubscription> = new Map();

  generateId(): string {
    return uuidv4();
  }

  saveLineVersion(version: LineVersion): LineVersion {
    this.lineVersions.set(version.id, version);
    return version;
  }

  findActiveLineVersion(lineId: string, at: Date = new Date()): LineVersion | undefined {
    return Array.from(this.lineVersions.values()).find(
      (v) =>
        v.lineId === lineId &&
        v.effectiveFrom <= at &&
        (!v.effectiveTo || v.effectiveTo > at)
    );
  }

  findAllLineVersions(lineId: string): LineVersion[] {
    return Array.from(this.lineVersions.values())
      .filter((v) => v.lineId === lineId)
      .sort((a, b) => b.version - a.version);
  }

  findLineVersionById(id: string): LineVersion | undefined {
    return this.lineVersions.get(id);
  }

  saveDetourEvent(event: DetourEvent): DetourEvent {
    this.detourEvents.set(event.id, event);
    return event;
  }

  findDetourEventById(id: string): DetourEvent | undefined {
    return this.detourEvents.get(id);
  }

  findActiveDetours(lineId: string): DetourEvent[] {
    return Array.from(this.detourEvents.values()).filter(
      (e) => e.lineId === lineId && e.status === 'ACTIVE'
    );
  }

  findDetoursByStatus(statuses: string[]): DetourEvent[] {
    return Array.from(this.detourEvents.values()).filter((e) =>
      statuses.includes(e.status)
    );
  }

  saveStopEta(eta: StopEta): StopEta {
    this.stopEtas.set(eta.id, eta);
    return eta;
  }

  findLatestEta(stopId: string, lineId: string): StopEta | undefined {
    const now = new Date();
    const etas = Array.from(this.stopEtas.values())
      .filter(
        (e) =>
          e.stopId === stopId &&
          e.lineId === lineId &&
          e.expiresAt > now
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return etas[0];
  }

  findEtasByDetour(detourEventId: string): StopEta[] {
    return Array.from(this.stopEtas.values()).filter(
      (e) => e.detourEventId === detourEventId
    );
  }

  saveNotification(notification: Notification): Notification {
    this.notifications.set(notification.id, notification);
    return notification;
  }

  findNotificationById(id: string): Notification | undefined {
    return this.notifications.get(id);
  }

  findNotificationsByDeduplicationKey(key: string): Notification[] {
    return Array.from(this.notifications.values()).filter(
      (n) => n.deduplicationKey === key
    );
  }

  findPendingNotifications(): Notification[] {
    const now = new Date();
    return Array.from(this.notifications.values()).filter(
      (n) =>
        n.status === 'PENDING' ||
        (n.status === 'FAILED' &&
          n.nextRetryAt !== undefined &&
          n.nextRetryAt <= now &&
          n.retryCount < n.maxRetries)
    );
  }

  findNotificationsByParent(parentId: string): Notification[] {
    return Array.from(this.notifications.values())
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  saveDriverReceipt(receipt: DriverReceipt): DriverReceipt {
    this.driverReceipts.set(receipt.id, receipt);
    return receipt;
  }

  findDriverReceiptById(id: string): DriverReceipt | undefined {
    return this.driverReceipts.get(id);
  }

  findReceiptsByDetour(detourEventId: string): DriverReceipt[] {
    return Array.from(this.driverReceipts.values()).filter(
      (r) => r.detourEventId === detourEventId
    );
  }

  findExpiredReceipts(): DriverReceipt[] {
    const now = new Date();
    return Array.from(this.driverReceipts.values()).filter(
      (r) => r.status === 'PENDING' && r.expiresAt <= now
    );
  }

  saveRunReport(report: RunReport): RunReport {
    this.runReports.set(report.id, report);
    return report;
  }

  findRunReport(date: string, lineId: string): RunReport | undefined {
    return Array.from(this.runReports.values()).find(
      (r) => r.date === date && r.lineId === lineId
    );
  }

  saveSubscription(sub: ParentSubscription): ParentSubscription {
    const key = `${sub.parentId}-${sub.lineId}-${sub.stopId}`;
    this.subscriptions.set(key, sub);
    return sub;
  }

  findSubscriptionsByLineAndStop(lineId: string, stopId: string): ParentSubscription[] {
    return Array.from(this.subscriptions.values()).filter(
      (s) => s.lineId === lineId && s.stopId === stopId && s.isActive
    );
  }

  findSubscriptionsByLine(lineId: string): ParentSubscription[] {
    return Array.from(this.subscriptions.values()).filter(
      (s) => s.lineId === lineId && s.isActive
    );
  }

  clearAll(): void {
    this.lineVersions.clear();
    this.detourEvents.clear();
    this.stopEtas.clear();
    this.notifications.clear();
    this.driverReceipts.clear();
    this.runReports.clear();
    this.subscriptions.clear();
  }

  getAllDetourEvents(): DetourEvent[] {
    return Array.from(this.detourEvents.values());
  }

  getAllNotifications(): Notification[] {
    return Array.from(this.notifications.values());
  }

  getAllDriverReceipts(): DriverReceipt[] {
    return Array.from(this.driverReceipts.values());
  }
}

export const repository = new MemoryRepository();
