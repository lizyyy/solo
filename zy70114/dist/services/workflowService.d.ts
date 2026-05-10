import { Order } from '../types';
export interface ProcessOrderResult {
    order: Order;
    currentStatus: string;
    nodes: {
        type: string;
        name: string;
        time: string;
    }[];
    mealTimer: {
        expectedMinutes: number;
        actualMinutes?: number;
        isOvertime: boolean;
        overtimeMinutes?: number;
        isRunning: boolean;
    };
    liability?: {
        liableParty: string;
        reason: string;
        judgmentType: string;
    };
    compensations: {
        type: string;
        target: string;
        amount: number;
        status: string;
    }[];
}
export interface CreateOrderRequest {
    idempotentKey?: string;
    orderNo: string;
    merchantId: string;
    merchantName: string;
    userId: string;
    userName: string;
    orderAmount: number;
    expectedMealMinutes: number;
    operatorId: string;
    operatorRole: string;
}
export declare const processCreateOrder: (req: CreateOrderRequest) => any;
export declare const processMerchantAccept: (orderId: string, operatorId: string, operatorRole: string) => {
    order_id: string;
    business_message: string;
};
export declare const processStartCooking: (orderId: string, operatorId: string, operatorRole: string) => {
    order_id: string;
    current_elapsed: string;
    remaining: string;
    business_message: string;
};
export declare const processMealReady: (orderId: string, operatorId: string, operatorRole: string) => {
    order_id: string;
    is_overtime: boolean;
    overtime_minutes: number;
    expected_minutes: number;
    actual_minutes: number | null;
    business_message: string;
};
export declare const processRiderPickup: (orderId: string, operatorId: string, operatorRole: string) => {
    order_id: string;
    business_message: string;
};
export declare const processDeliver: (orderId: string, operatorId: string, operatorRole: string) => {
    order_id: string;
    business_message: string;
};
export declare const processAssignRider: (orderId: string, riderId: string, riderName: string, operatorId: string, operatorRole: string) => {
    order_id: string;
    rider_id: string;
    rider_name: string;
    business_message: string;
};
export declare const processOvertimeWorkflow: (orderId: string, operatorId: string, operatorRole: string) => {
    order_id: string;
    liability: {
        liable_party: import("../types").LiabilityParty;
        liable_party_name: string;
        reason: string;
        judgment_type: import("../types").JudgmentType;
    };
    compensations: {
        type: string;
        target: string;
        amount: number;
    }[];
    business_message: string;
};
export declare const getOrderFullInfo: (orderId: string) => ProcessOrderResult;
export declare const formatOrderInfo: (info: ProcessOrderResult) => string;
