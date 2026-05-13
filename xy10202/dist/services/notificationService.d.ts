import { Notification, NotificationType, NotificationChannel, NotificationStatus, NotificationRecipientType, Order, RiskEvent } from '../types';
export declare function createNotification(params: {
    eventId?: string;
    rebookingId?: string;
    orderId?: string;
    recipientId: string;
    recipientType: NotificationRecipientType;
    recipientName: string;
    recipientContact: string;
    type: NotificationType;
    channel: NotificationChannel;
    title: string;
    content: string;
}): Notification;
export declare function simulateSendNotification(notificationId: string, failProbability?: number): {
    success: boolean;
    error?: string;
};
export declare function acknowledgeNotification(notificationId: string, acknowledgedBy: string, note?: string): Notification | null;
export declare function retryNotification(notificationId: string): Notification | null;
export declare function generateRiskAlertNotifications(event: RiskEvent): Notification[];
export declare function generateRebookingInitiatedNotifications(event: RiskEvent, rebookingId: string, order: Order, availableSitesCount: number): Notification[];
export declare function generateRebookingCompletedNotifications(event: RiskEvent, rebookingId: string, order: Order, originalSiteNumber: string, targetSiteNumber: string): Notification[];
export declare function generateEventCancelledNotifications(event: RiskEvent): Notification[];
export declare function queryNotifications(filters: {
    eventId?: string;
    status?: NotificationStatus;
    recipientType?: NotificationRecipientType;
    type?: NotificationType;
}): Notification[];
