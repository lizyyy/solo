import { EntityType } from '../../../common/types';
export declare class AuditLog {
    id: string;
    entityType: EntityType;
    entityId: string;
    entityNumber: string;
    action: string;
    description: string;
    operatorId: string;
    operatorName: string;
    operatorRole: string;
    sourceIp: string;
    userAgent: string;
    beforeData: Record<string, any>;
    afterData: Record<string, any>;
    requestData: Record<string, any>;
    remarks: string;
    createdAt: Date;
}
