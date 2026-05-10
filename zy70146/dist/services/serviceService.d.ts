export declare const serviceService: {
    create(tenantId: string, name: string, description?: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
    }>;
    list(tenantId: string): Promise<({
        _count: {
            sloConfigs: number;
            endpoints: number;
        };
    } & {
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
    })[]>;
    getById(id: string): Promise<({
        sloConfigs: {
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
        }[];
        endpoints: {
            id: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            method: string;
            path: string;
            serviceId: string;
        }[];
    } & {
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
    }) | null>;
    update(id: string, data: {
        name?: string;
        description?: string;
    }): Promise<{
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
    }>;
    delete(id: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
    }>;
};
export declare const endpointService: {
    create(serviceId: string, method: string, path: string, description?: string): Promise<{
        id: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        method: string;
        path: string;
        serviceId: string;
    }>;
    list(serviceId: string): Promise<{
        id: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        method: string;
        path: string;
        serviceId: string;
    }[]>;
    getById(id: string): Promise<{
        id: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        method: string;
        path: string;
        serviceId: string;
    } | null>;
    update(id: string, data: {
        method?: string;
        path?: string;
        description?: string;
    }): Promise<{
        id: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        method: string;
        path: string;
        serviceId: string;
    }>;
    delete(id: string): Promise<{
        id: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        method: string;
        path: string;
        serviceId: string;
    }>;
};
