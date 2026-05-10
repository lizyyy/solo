export interface GiftRule {
    id: string;
    name: string;
    description: string;
    version: number;
    priority: number;
    effectiveTime: string;
    expireTime: string;
    conditions: RuleCondition;
    gifts: RuleGift[];
    createdAt: string;
}
export interface RuleCondition {
    minAmount?: number;
    minQuantity?: number;
    includeCategories?: string[];
    excludeCategories?: string[];
    includeSkus?: string[];
    excludeSkus?: string[];
}
export interface RuleGift {
    giftSku: string;
    giftName: string;
    quantity: number;
}
export interface Order {
    orderId: string;
    userId: string;
    createTime: string;
    totalAmount: number;
    items: OrderItem[];
    actualGifts?: ActualGift[];
}
export interface OrderItem {
    sku: string;
    name: string;
    category: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}
export interface ActualGift {
    giftSku: string;
    giftName: string;
    quantity: number;
    sourceRuleId?: string;
}
export interface Inventory {
    giftSku: string;
    giftName: string;
    totalQuantity: number;
    availableQuantity: number;
}
export interface ReplayResult {
    orderId: string;
    orderCreateTime: string;
    matchedRules: MatchedRuleDetail[];
    recommendedGifts: GiftRecommendation[];
    conflicts: ConflictDetail[];
    explanation: string;
}
export interface MatchedRuleDetail {
    ruleId: string;
    ruleName: string;
    priority: number;
    matchScore: number;
    matchReason: string;
    matchedAt: string;
}
export interface GiftRecommendation {
    giftSku: string;
    giftName: string;
    quantity: number;
    sourceRuleId: string;
    status: 'granted' | 'denied' | 'pending';
    reason: string;
}
export interface ConflictDetail {
    type: 'rule_overlap' | 'insufficient_inventory' | 'amount_changed' | 'already_granted';
    severity: 'info' | 'warning' | 'error';
    message: string;
    details: Record<string, any>;
}
export interface ReplayState {
    lastReplayTime: string;
    processedOrders: string[];
    inventorySnapshot: Inventory[];
    grants: GiftGrantRecord[];
}
export interface GiftGrantRecord {
    orderId: string;
    giftSku: string;
    giftName: string;
    quantity: number;
    grantedAt: string;
    ruleId: string;
    replayId: string;
}
export interface DiffReport {
    orderId: string;
    orderCreateTime: string;
    expectedGifts: GiftRecommendation[];
    actualGifts: ActualGift[];
    diffType: 'missing' | 'extra' | 'quantity_mismatch' | 'match';
    diffDetails: string;
}
export interface ExportConfig {
    includeConflicts: boolean;
    includeExplanations: boolean;
    format: 'csv' | 'json';
}
//# sourceMappingURL=index.d.ts.map