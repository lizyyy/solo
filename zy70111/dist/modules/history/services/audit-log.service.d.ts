import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { EntityType, UserContext } from '../../../common/types';
export declare class AuditLogService {
    private readonly auditLogRepository;
    constructor(auditLogRepository: Repository<AuditLog>);
    log(params: {
        entityType: EntityType;
        entityId: string;
        entityNumber?: string;
        action: string;
        description: string;
        user: UserContext;
        beforeData?: any;
        afterData?: any;
        requestData?: any;
        sourceIp?: string;
        userAgent?: string;
        remarks?: string;
    }): Promise<AuditLog>;
    findByEntity(entityType: EntityType, entityId: string): Promise<AuditLog[]>;
    findByOperator(operatorId: string): Promise<AuditLog[]>;
    findByTimeRange(startTime: Date, endTime: Date): Promise<AuditLog[]>;
}
