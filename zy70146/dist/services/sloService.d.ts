import { SLOType, TimeWindowType } from '../types/enums';
export declare const sloService: {
    create(tenantId: string, name: string, type: SLOType, targetValue: number, timeWindowType: TimeWindowType, options?: {
        serviceId?: string;
        endpointId?: string;
        description?: string;
        operator?: string;
    }): Promise<{
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        serviceId: string | null;
        type: string;
        targetValue: number;
        timeWindowType: string;
        isActive: boolean;
        endpointId: string | null;
    }>;
    list(tenantId: string, options?: {
        isActive?: boolean;
        serviceId?: string;
        endpointId?: string;
    }): Promise<({
        _count: {
            budgets: number;
        };
        service: {
            id: string;
            name: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
        } | null;
        endpoint: {
            id: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            method: string;
            path: string;
            serviceId: string;
        } | null;
    } & {
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        serviceId: string | null;
        type: string;
        targetValue: number;
        timeWindowType: string;
        isActive: boolean;
        endpointId: string | null;
    })[]>;
    getById(id: string): Promise<({
        budgets: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            sloConfigId: string;
            windowStart: Date;
            windowEnd: Date;
            windowType: string;
            totalBudget: number;
            usedBudget: number;
            remainingBudget: number;
            isFrozen: boolean;
            frozenAt: Date | null;
            frozenReason: string | null;
        }[];
        service: {
            id: string;
            name: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
        } | null;
        endpoint: {
            id: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            method: string;
            path: string;
            serviceId: string;
        } | null;
    } & {
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        serviceId: string | null;
        type: string;
        targetValue: number;
        timeWindowType: string;
        isActive: boolean;
        endpointId: string | null;
    }) | null>;
    update(id: string, data: {
        name?: string;
        targetValue?: number;
        description?: string;
        isActive?: boolean;
    }): Promise<{
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        serviceId: string | null;
        type: string;
        targetValue: number;
        timeWindowType: string;
        isActive: boolean;
        endpointId: string | null;
    }>;
    delete(id: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        serviceId: string | null;
        type: string;
        targetValue: number;
        timeWindowType: string;
        isActive: boolean;
        endpointId: string | null;
    }>;
    activate(id: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        serviceId: string | null;
        type: string;
        targetValue: number;
        timeWindowType: string;
        isActive: boolean;
        endpointId: string | null;
    }>;
    deactivate(id: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        serviceId: string | null;
        type: string;
        targetValue: number;
        timeWindowType: string;
        isActive: boolean;
        endpointId: string | null;
    }>;
};
