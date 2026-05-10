import { ProcessStatus, ProcessStep } from '../types/enums';
interface CreateTraceOptions {
    tenantId: string;
    sloConfigId?: string;
    step: ProcessStep;
    status: ProcessStatus;
    currentCheckpoint?: string;
    checkpointMessage?: string;
    previousTraceId?: string;
    operator?: string;
    metadata?: Record<string, any>;
}
export declare const processTraceService: {
    create(options: CreateTraceOptions): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        step: string;
        sloConfigId: string | null;
        status: string;
        currentCheckpoint: string | null;
        checkpointMessage: string | null;
        previousTraceId: string | null;
        operator: string | null;
        metadata: string | null;
    }>;
    update(id: string, data: Partial<Omit<CreateTraceOptions, "tenantId" | "step">>): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        step: string;
        sloConfigId: string | null;
        status: string;
        currentCheckpoint: string | null;
        checkpointMessage: string | null;
        previousTraceId: string | null;
        operator: string | null;
        metadata: string | null;
    }>;
    getById(id: string): Promise<{
        metadata: any;
        previousTrace: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            step: string;
            sloConfigId: string | null;
            status: string;
            currentCheckpoint: string | null;
            checkpointMessage: string | null;
            previousTraceId: string | null;
            operator: string | null;
            metadata: string | null;
        } | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        step: string;
        sloConfigId: string | null;
        status: string;
        currentCheckpoint: string | null;
        checkpointMessage: string | null;
        previousTraceId: string | null;
        operator: string | null;
    } | null>;
    list(tenantId: string, options?: {
        step?: ProcessStep;
        status?: ProcessStatus;
        sloConfigId?: string;
        limit?: number;
    }): Promise<{
        metadata: any;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        step: string;
        sloConfigId: string | null;
        status: string;
        currentCheckpoint: string | null;
        checkpointMessage: string | null;
        previousTraceId: string | null;
        operator: string | null;
    }[]>;
    getCurrentBlocker(tenantId: string, sloConfigId?: string): Promise<{
        hasBlocker: boolean;
        currentBlocker?: undefined;
        previousTrace?: undefined;
    } | {
        hasBlocker: boolean;
        currentBlocker: {
            metadata: any;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            step: string;
            sloConfigId: string | null;
            status: string;
            currentCheckpoint: string | null;
            checkpointMessage: string | null;
            previousTraceId: string | null;
            operator: string | null;
        };
        previousTrace: {
            metadata: any;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            step: string;
            sloConfigId: string | null;
            status: string;
            currentCheckpoint: string | null;
            checkpointMessage: string | null;
            previousTraceId: string | null;
            operator: string | null;
        } | null;
    }>;
    getTraceChain(traceId: string): Promise<any[]>;
};
export {};
