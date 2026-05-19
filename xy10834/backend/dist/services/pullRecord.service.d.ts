import { PullStatus } from '../types';
export interface ReportPullResultDTO {
    configId: string;
    instanceId: string;
    distributionId?: string;
    actualVersion: number;
    pullStatus: PullStatus;
    errorMessage?: string;
}
export declare class PullRecordService {
    reportPullResult(dto: ReportPullResultDTO): Promise<{
        pullRecord: {
            id: string;
            pulledAt: Date;
            configId: string;
            instanceId: string;
            distributionId: string | null;
            requestedVersion: number;
            actualVersion: number | null;
            pullStatus: string;
            errorMessage: string | null;
            retryCount: number;
            nextRetryAt: Date | null;
        };
        effectiveState: {
            id: string;
            configId: string;
            instanceId: string;
            pullRecordId: string | null;
            currentVersion: number;
            effectiveStatus: string;
            checkedAt: Date;
            lastConfirmedAt: Date | null;
            compensatedAt: Date | null;
            compensateStatus: string;
            compensateNote: string | null;
        };
    } | {
        pullRecord: {
            id: string;
            pulledAt: Date;
            configId: string;
            instanceId: string;
            distributionId: string | null;
            requestedVersion: number;
            actualVersion: number | null;
            pullStatus: string;
            errorMessage: string | null;
            retryCount: number;
            nextRetryAt: Date | null;
        };
        effectiveState?: undefined;
    }>;
    findAll(params: {
        page?: number;
        pageSize?: number;
        configId?: string;
        instanceId?: string;
        pullStatus?: PullStatus;
    }): Promise<{
        records: ({
            configItem: {
                key: string;
                version: number;
            };
            serviceInstance: {
                instanceId: string;
                serviceName: string;
                ipAddress: string;
            };
        } & {
            id: string;
            pulledAt: Date;
            configId: string;
            instanceId: string;
            distributionId: string | null;
            requestedVersion: number;
            actualVersion: number | null;
            pullStatus: string;
            errorMessage: string | null;
            retryCount: number;
            nextRetryAt: Date | null;
        })[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    }>;
    getFailedRecords(configId?: string): Promise<({
        configItem: {
            id: string;
            key: string;
            value: string;
            description: string | null;
            status: string;
            version: number;
            createdAt: Date;
            updatedAt: Date;
            createdBy: string | null;
        };
        serviceInstance: {
            id: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            instanceId: string;
            serviceName: string;
            ipAddress: string;
            hostname: string | null;
            env: string;
            lastHeartbeat: Date;
        };
    } & {
        id: string;
        pulledAt: Date;
        configId: string;
        instanceId: string;
        distributionId: string | null;
        requestedVersion: number;
        actualVersion: number | null;
        pullStatus: string;
        errorMessage: string | null;
        retryCount: number;
        nextRetryAt: Date | null;
    })[]>;
    retryFailed(recordId: string): Promise<{
        id: string;
        pulledAt: Date;
        configId: string;
        instanceId: string;
        distributionId: string | null;
        requestedVersion: number;
        actualVersion: number | null;
        pullStatus: string;
        errorMessage: string | null;
        retryCount: number;
        nextRetryAt: Date | null;
    }>;
    detectOldValues(configId: string): Promise<{
        configVersion: number;
        oldValueCount: number;
        instances: ({
            serviceInstance: {
                id: string;
                status: string;
                createdAt: Date;
                updatedAt: Date;
                instanceId: string;
                serviceName: string;
                ipAddress: string;
                hostname: string | null;
                env: string;
                lastHeartbeat: Date;
            };
        } & {
            id: string;
            configId: string;
            instanceId: string;
            pullRecordId: string | null;
            currentVersion: number;
            effectiveStatus: string;
            checkedAt: Date;
            lastConfirmedAt: Date | null;
            compensatedAt: Date | null;
            compensateStatus: string;
            compensateNote: string | null;
        })[];
    }>;
}
declare const _default: PullRecordService;
export default _default;
