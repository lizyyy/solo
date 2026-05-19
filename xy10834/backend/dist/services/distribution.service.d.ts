export interface PublishVersionDTO {
    configId: string;
    releasedBy?: string;
    releaseNote?: string;
    isForce?: boolean;
}
export declare class DistributionService {
    publishVersion(dto: PublishVersionDTO): Promise<{
        id: string;
        version: number;
        createdAt: Date;
        releasedAt: Date;
        configId: string;
        releasedBy: string | null;
        releaseNote: string | null;
        isForce: boolean;
    }>;
    getAllVersions(params: {
        page?: number;
        pageSize?: number;
        configId?: string;
    }): Promise<{
        items: ({
            configItem: {
                key: string;
                version: number;
            };
            _count: {
                pullRecords: number;
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
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    }>;
    getVersions(configId: string): Promise<({
        _count: {
            pullRecords: number;
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
    })[]>;
    getVersionDetail(versionId: string): Promise<{
        stats: {
            total: number;
            success: number;
            failed: number;
            pending: number;
        };
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
        pullRecords: ({
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
        id: string;
        version: number;
        createdAt: Date;
        releasedAt: Date;
        configId: string;
        releasedBy: string | null;
        releaseNote: string | null;
        isForce: boolean;
    }>;
    forceRefresh(configId: string): Promise<{
        refreshed: number;
    }>;
}
declare const _default: DistributionService;
export default _default;
