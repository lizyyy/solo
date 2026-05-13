export type RiskLevel = 'NO_RISK' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SiteType = 'STANDARD' | 'PREMIUM' | 'ELEVATED' | 'LOW_LYING';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'REBOOKING' | 'REBOOKED' | 'CANCELLED' | 'COMPLETED';
export type RiskEventStatus = 'DRAFT' | 'ACTIVE' | 'PROCESSING' | 'RESOLVED' | 'CANCELLED';
export type RebookingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
export type LockType = 'RISK_EVENT' | 'REBOOKING' | 'RESERVATION';
export type OperationType = 'CREATE_EVENT' | 'ASSESS_SITES' | 'LOCK_SITE' | 'CREATE_REBOOKING' | 'PROCESS_REBOOKING' | 'CANCEL_EVENT' | 'MODIFY_EVENT' | 'QUERY_SUMMARY' | 'SEND_NOTIFICATION' | 'QUERY_NOTIFICATIONS' | 'ACK_NOTIFICATION' | 'RETRY_NOTIFICATION';
export type NotificationType = 'RISK_ALERT' | 'REBOOKING_INITIATED' | 'REBOOKING_COMPLETED' | 'EVACUATION_ORDER' | 'CAMP_STAFF_ALERT' | 'EVENT_CANCELLED' | 'EVENT_RESOLVED';
export type NotificationChannel = 'SMS' | 'EMAIL' | 'APP_PUSH' | 'IN_APP';
export type NotificationStatus = 'PENDING' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'ACKNOWLEDGED' | 'CANCELLED';
export type NotificationRecipientType = 'CUSTOMER' | 'CAMP_STAFF' | 'MANAGER';
export interface Notification {
    notificationId: string;
    notificationNumber: string;
    eventId: string | null;
    rebookingId: string | null;
    orderId: string | null;
    recipientId: string;
    recipientType: NotificationRecipientType;
    recipientName: string;
    recipientContact: string;
    type: NotificationType;
    channel: NotificationChannel;
    title: string;
    content: string;
    status: NotificationStatus;
    sentAt: string | null;
    deliveredAt: string | null;
    acknowledgedAt: string | null;
    acknowledgedBy: string | null;
    acknowledgementNote: string | null;
    createdAt: string;
    updatedAt: string;
    retryCount: number;
    maxRetries: number;
    lastError: string | null;
}
export interface CreateNotificationRequest {
    requestId: string;
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
    source: string;
}
export interface SendNotificationRequest {
    requestId: string;
    notificationId: string;
    source: string;
}
export interface AcknowledgeNotificationRequest {
    requestId: string;
    notificationId: string;
    acknowledgedBy: string;
    note?: string;
    source: string;
}
export interface RetryNotificationRequest {
    requestId: string;
    notificationId: string;
    source: string;
}
export interface QueryNotificationsRequest {
    eventId?: string;
    status?: NotificationStatus;
    recipientType?: NotificationRecipientType;
    type?: NotificationType;
}
export interface Site {
    siteId: string;
    siteNumber: string;
    type: SiteType;
    elevation: number;
    distanceToWater: number;
    riskLevel: RiskLevel;
    isOccupied: boolean;
    isLocked: boolean;
    lockedBy: string | null;
    attributes: Record<string, any>;
}
export interface Order {
    orderId: string;
    orderNumber: string;
    customerName: string;
    siteId: string;
    checkInDate: string;
    checkOutDate: string;
    status: OrderStatus;
    guestCount: number;
    isCheckedin: boolean;
}
export interface WeatherAlert {
    alertId: string;
    alertType: string;
    severity: string;
    validFrom: string;
    validTo: string;
    description: string;
}
export interface RiskEvent {
    eventId: string;
    eventNumber: string;
    weatherAlert: WeatherAlert;
    status: RiskEventStatus;
    assessedSites: AssessedSite[];
    affectedOrders: string[];
    rebookings: string[];
    createdAt: string;
    updatedAt: string;
}
export interface AssessedSite {
    siteId: string;
    siteNumber: string;
    originalRiskLevel: RiskLevel;
    assessedRiskLevel: RiskLevel;
    assessmentReason: string;
    assessmentTime: string;
    actionRequired: 'EVACUATE' | 'MONITOR' | 'REASSIGN' | 'NONE';
}
export interface Rebooking {
    rebookingId: string;
    rebookingNumber: string;
    eventId: string;
    originalOrderId: string;
    originalSiteId: string;
    targetSiteId: string | null;
    status: RebookingStatus;
    reason: string;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
}
export interface ResourceLock {
    lockId: string;
    siteId: string;
    lockType: LockType;
    lockedBy: string;
    lockedAt: string;
    expiresAt: string;
    reason: string;
    isActive: boolean;
}
export interface ProblemRecord {
    problemId: string;
    operationType: OperationType;
    requestId: string;
    errorType: string;
    errorMessage: string;
    requestData: any;
    source: string;
    createdAt: string;
    status: 'OPEN' | 'RESOLVED' | 'IGNORED';
    resolvedAt: string | null;
    resolution: string | null;
}
export interface IdempotentRecord {
    requestId: string;
    operationType: OperationType;
    inputHash: string;
    result: any;
    createdAt: string;
    expiresAt: string;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    requestId: string;
    timestamp: string;
}
export interface CreateRiskEventRequest {
    requestId: string;
    weatherAlert: {
        alertId: string;
        alertType: string;
        severity: string;
        validFrom: string;
        validTo: string;
        description: string;
    };
    source: string;
}
export interface AssessSiteRequest {
    requestId: string;
    eventId: string;
    siteId: string;
    assessedRiskLevel: RiskLevel;
    assessmentReason: string;
    source: string;
}
export interface CreateRebookingRequest {
    requestId: string;
    eventId: string;
    orderId: string;
    reason: string;
    source: string;
}
export interface ProcessRebookingRequest {
    requestId: string;
    rebookingId: string;
    targetSiteId: string;
    source: string;
}
export interface CancelEventRequest {
    requestId: string;
    eventId: string;
    reason: string;
    source: string;
}
export interface ModifyEventRequest {
    requestId: string;
    eventId: string;
    updates: Partial<Pick<RiskEvent, 'status'>> & Record<string, any>;
    source: string;
}
export interface QuerySummaryRequest {
    eventId?: string;
    status?: RiskEventStatus;
}
export interface RiskAssessmentRule {
    id: string;
    name: string;
    condition: (site: Site, weatherAlert: WeatherAlert) => RiskLevel;
    priority: number;
}
