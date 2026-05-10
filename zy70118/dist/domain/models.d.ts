import { BatchStatus, TemperatureCheckItem, WeightCheckItem, TicketItem, RejectionReason, ReplenishmentInfo } from './types';
export interface Batch {
    id: string;
    supplierId: string;
    materialCode: string;
    materialName: string;
    quantity: number;
    unit: string;
    expectedDeliveryDate: Date;
    actualDeliveryDate: Date;
    vehiclePlate?: string;
    driverId?: string;
    operatorId: string;
    createdAt: Date;
    status: BatchStatus;
    temperatureChecks: TemperatureCheckItem[];
    weightChecks: WeightCheckItem[];
    ticketChecks: TicketItem[];
    rejectionReasons: RejectionReason[];
    replenishmentInfo?: ReplenishmentInfo;
    lastUpdatedAt: Date;
    version: number;
    inspectionNote?: string;
}
export interface CreateBatchRequest {
    supplierId: string;
    materialCode: string;
    materialName: string;
    quantity: number;
    unit: string;
    expectedDeliveryDate: Date;
    actualDeliveryDate: Date;
    vehiclePlate?: string;
    driverId?: string;
    operatorId: string;
}
export interface TemperatureCheckRequest {
    batchId: string;
    items: Array<{
        location: string;
        value: number;
        unit: 'CELSIUS' | 'FAHRENHEIT';
        measuredAt: Date;
        operatorId: string;
    }>;
    note?: string;
}
export interface WeightCheckRequest {
    batchId: string;
    items: Array<{
        expected: number;
        actual: number;
        unit: 'KILOGRAM' | 'GRAM' | 'POUND';
    }>;
    operatorId: string;
    note?: string;
}
export interface TicketCheckRequest {
    batchId: string;
    items: Array<{
        type: string;
        provided: boolean;
        valid?: boolean;
        ticketNumber?: string;
        issueDate?: Date;
        expiryDate?: Date;
    }>;
    operatorId: string;
    note?: string;
}
export interface RejectBatchRequest {
    batchId: string;
    reasons: Array<{
        type: 'TEMPERATURE' | 'WEIGHT' | 'TICKET';
        code: string;
        description: string;
        detail: string;
    }>;
    operatorId: string;
}
export interface ReplenishBatchRequest {
    batchId: string;
    operatorId: string;
    note?: string;
    newBatchId?: string;
}
export interface AcceptBatchRequest {
    batchId: string;
    operatorId: string;
    note?: string;
    partialAccept?: boolean;
    acceptedQuantity?: number;
}
