export type OrderStatus = 'pending' | 'accepted' | 'picking' | 'delivering' | 'completed' | 'cancelled';
export type AppealType = 'timeout' | 'bad_review' | 'cancellation';
export type AppealStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'corrected';
export type WeatherType = 'sunny' | 'rain' | 'heavy_rain' | 'storm' | 'fog' | 'snow';
export interface Order {
    id: string;
    orderNo: string;
    riderId: string;
    riderName: string;
    merchantId: string;
    merchantName: string;
    userId: string;
    userName: string;
    merchantAddress: string;
    deliveryAddress: string;
    estimatedDeliveryTime: number;
    actualDeliveryTime?: number;
    promisedTime: number;
    createTime: number;
    acceptTime?: number;
    arriveMerchantTime?: number;
    pickUpTime?: number;
    deliverTime?: number;
    status: OrderStatus;
    cancelReason?: string;
    cancelTime?: number;
    cancelInitiator?: 'user' | 'merchant' | 'rider' | 'system';
}
export interface RiderTrajectory {
    id: string;
    orderNo: string;
    riderId: string;
    timestamp: number;
    latitude: number;
    longitude: number;
    speed?: number;
    accuracy?: number;
    eventType?: 'idle' | 'moving' | 'paused';
}
export interface MerchantMeal {
    id: string;
    orderNo: string;
    merchantId: string;
    expectedReadyTime: number;
    actualReadyTime: number;
    prepareStartTime?: number;
    note?: string;
}
export interface WeatherEvent {
    id: string;
    city: string;
    region?: string;
    startTime: number;
    endTime: number;
    weatherType: WeatherType;
    description: string;
    intensity?: 'light' | 'moderate' | 'heavy';
}
export interface PlatformPenalty {
    id: string;
    orderNo: string;
    riderId: string;
    penaltyType: 'timeout' | 'bad_review' | 'cancellation';
    penaltyAmount: number;
    penaltyReason: string;
    createTime: number;
    status: 'active' | 'reverted' | 'partial_reverted';
    revertedAmount?: number;
}
export interface Appeal {
    id: string;
    orderNo: string;
    riderId: string;
    appealType: AppealType;
    appealReason: string;
    submitTime: number;
    status: AppealStatus;
    checkResult?: string;
    checkEvidence?: string;
    checkTime?: number;
    revertedAmount?: number;
    operator?: string;
}
export interface AppealCorrection {
    id: string;
    appealId: string;
    operator: string;
    beforeStatus: AppealStatus;
    afterStatus: AppealStatus;
    beforeRevertedAmount?: number;
    afterRevertedAmount?: number;
    beforeCheckResult?: string;
    afterCheckResult?: string;
    reason: string;
    createTime: number;
}
export interface AppealHistory {
    id: string;
    orderNo: string;
    appealId: string;
    action: string;
    operator?: string;
    fromStatus?: AppealStatus;
    toStatus?: AppealStatus;
    details?: string;
    createTime: number;
}
export interface ImportResult {
    total: number;
    success: number;
    failed: number;
    failures: Array<{
        index: number;
        reason: string;
        data: any;
    }>;
}
export interface CheckResult {
    appealId: string;
    orderNo: string;
    appealType: AppealType;
    status: AppealStatus;
    evidences: Evidence[];
    rules: RuleResult[];
    finalDecision: string;
    revertedAmount?: number;
    checkTime: number;
}
export interface Evidence {
    type: 'order' | 'trajectory' | 'merchant' | 'weather' | 'penalty';
    title: string;
    content: string;
    timestamp?: number;
}
export interface RuleResult {
    ruleId: string;
    ruleName: string;
    passed: boolean;
    reason: string;
    weight: number;
}
//# sourceMappingURL=index.d.ts.map