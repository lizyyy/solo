import { AuditLog } from '@prisma/client';
interface CreateAuditLogParams {
    action: string;
    entityType: string;
    entityId: string;
    userId: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
}
export declare const createAuditLog: (params: CreateAuditLogParams) => Promise<AuditLog>;
export declare const getAuditLogs: (params: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}) => Promise<{
    logs: ({
        user: {
            id: string;
            username: string;
            name: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
    } & {
        id: string;
        action: string;
        entityType: string;
        entityId: string;
        oldValues: import("@prisma/client/runtime/library").JsonValue | null;
        newValues: import("@prisma/client/runtime/library").JsonValue | null;
        userId: string;
        timestamp: Date;
        ipAddress: string | null;
        userAgent: string | null;
        requestInfo: import("@prisma/client/runtime/library").JsonValue | null;
    })[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}>;
export declare const getEntityTimeline: (entityType: string, entityId: string) => Promise<({
    user: {
        id: string;
        username: string;
        name: string;
        role: import(".prisma/client").$Enums.UserRole;
    };
} & {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValues: import("@prisma/client/runtime/library").JsonValue | null;
    newValues: import("@prisma/client/runtime/library").JsonValue | null;
    userId: string;
    timestamp: Date;
    ipAddress: string | null;
    userAgent: string | null;
    requestInfo: import("@prisma/client/runtime/library").JsonValue | null;
})[]>;
export {};
