import { AlertSubscription, AlertSubscriptionStatus } from '../types';
export interface CreateSubscriptionRequest {
    ruleVersionId: string;
    subscriberId: string;
    subscriberName: string;
    email: string;
    operator: string;
}
export interface UpdateSubscriptionRequest {
    email?: string;
    subscriberName?: string;
    operator: string;
}
export declare function createSubscription(request: CreateSubscriptionRequest): Promise<AlertSubscription>;
export declare function getSubscriptionById(id: string): Promise<AlertSubscription | null>;
export declare function getSubscriptionBySubscriber(ruleVersionId: string, subscriberId: string): Promise<AlertSubscription | null>;
export declare function listSubscriptionsByRuleVersion(ruleVersionId: string, options?: {
    page?: number;
    pageSize?: number;
    status?: AlertSubscriptionStatus;
}): Promise<{
    subscriptions: AlertSubscription[];
    total: number;
}>;
export declare function updateSubscription(id: string, request: UpdateSubscriptionRequest): Promise<AlertSubscription>;
export declare function cancelSubscription(id: string, operator: string): Promise<AlertSubscription>;
export declare function reactivateSubscription(id: string, operator: string): Promise<AlertSubscription>;
export declare function recordNotificationSuccess(id: string): Promise<AlertSubscription>;
export declare function recordNotificationError(id: string, errorMessage: string): Promise<AlertSubscription>;
//# sourceMappingURL=alertSubscriptionService.d.ts.map