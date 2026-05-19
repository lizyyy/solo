import { InstanceStatus } from '../types';
export interface CreateServiceInstanceDTO {
    instanceId: string;
    serviceName: string;
    ipAddress: string;
    hostname?: string;
    env: string;
}
export declare class ServiceInstanceService {
    create(dto: CreateServiceInstanceDTO): Promise<{
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
    }>;
    findAll(params: {
        page?: number;
        pageSize?: number;
        serviceName?: string;
        env?: string;
        status?: InstanceStatus;
    }): Promise<{
        instances: ({
            _count: {
                pullRecords: number;
                effectiveStates: number;
            };
        } & {
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
        })[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    }>;
    findById(id: string): Promise<{
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
        effectiveStates: {
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
        }[];
    } & {
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
    }>;
    heartbeat(instanceId: string, env: string): Promise<{
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
    }>;
    updateStatus(id: string, status: InstanceStatus): Promise<{
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
    }>;
    delete(id: string): Promise<{
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
    }>;
}
declare const _default: ServiceInstanceService;
export default _default;
