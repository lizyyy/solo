import { ConfigStatus } from '../types';
export interface CreateConfigItemDTO {
    key: string;
    value: string;
    description?: string;
    createdBy?: string;
}
export interface UpdateConfigItemDTO {
    value?: string;
    description?: string;
    status?: ConfigStatus;
}
export declare class ConfigItemService {
    create(dto: CreateConfigItemDTO): Promise<{
        id: string;
        key: string;
        value: string;
        description: string | null;
        status: string;
        version: number;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
    }>;
    findAll(params: {
        page?: number;
        pageSize?: number;
        status?: ConfigStatus;
        key?: string;
    }): Promise<{
        items: ({
            _count: {
                versions: number;
                pullRecords: number;
            };
        } & {
            id: string;
            key: string;
            value: string;
            description: string | null;
            status: string;
            version: number;
            createdAt: Date;
            updatedAt: Date;
            createdBy: string | null;
        })[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    }>;
    findById(id: string): Promise<{
        versions: {
            id: string;
            version: number;
            createdAt: Date;
            releasedAt: Date;
            configId: string;
            releasedBy: string | null;
            releaseNote: string | null;
            isForce: boolean;
        }[];
        pullRecords: {
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
        }[];
        diffReports: {
            id: string;
            generatedAt: Date;
            configId: string;
            baseVersion: number;
            targetVersion: number;
            diffContent: string;
            affectedInstances: number;
            generatedBy: string | null;
            exportedAt: Date | null;
        }[];
    } & {
        id: string;
        key: string;
        value: string;
        description: string | null;
        status: string;
        version: number;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
    }>;
    update(id: string, dto: UpdateConfigItemDTO): Promise<{
        id: string;
        key: string;
        value: string;
        description: string | null;
        status: string;
        version: number;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
    }>;
    delete(id: string): Promise<{
        id: string;
        key: string;
        value: string;
        description: string | null;
        status: string;
        version: number;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
    }>;
    getVersions(configId: string): Promise<{
        id: string;
        version: number;
        createdAt: Date;
        releasedAt: Date;
        configId: string;
        releasedBy: string | null;
        releaseNote: string | null;
        isForce: boolean;
    }[]>;
}
declare const _default: ConfigItemService;
export default _default;
