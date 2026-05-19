export declare class OverviewService {
    getStatistics(): Promise<{
        config: {
            total: number;
            published: number;
            draft: number;
        };
        instance: {
            total: number;
            online: number;
            offline: number;
        };
        pull: {
            total: number;
            success: number;
            failed: number;
            pending: number;
            timeout: number;
        };
        effective: {
            total: number;
            effective: number;
            notEffective: number;
            partial: number;
            unknown: number;
        };
        compensate: {
            total: number;
            completed: number;
            pending: number;
            inProgress: number;
            failed: number;
            notNeeded: number;
        };
        oldValueCount: number;
        recentVersions: ({
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
        } & {
            id: string;
            version: number;
            createdAt: Date;
            releasedAt: Date;
            configId: string;
            releasedBy: string | null;
            releaseNote: string | null;
            isForce: boolean;
        })[];
    }>;
    private detectAllOldValues;
    getRecentActivity(limit?: number): Promise<({
        type: string;
        time: Date;
        data: {
            configItem: {
                key: string;
            };
            serviceInstance: {
                instanceId: string;
                serviceName: string;
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
        };
    } | {
        type: string;
        time: Date;
        data: {
            configItem: {
                key: string;
            };
        } & {
            id: string;
            version: number;
            createdAt: Date;
            releasedAt: Date;
            configId: string;
            releasedBy: string | null;
            releaseNote: string | null;
            isForce: boolean;
        };
    })[]>;
    getFailedDetails(): Promise<{
        failedPulls: ({
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
        })[];
        compensationPending: ({
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
declare const _default: OverviewService;
export default _default;
