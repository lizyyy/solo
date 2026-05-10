import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { EntityType, UserContext } from '../../../common/types';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(params: {
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
  }): Promise<AuditLog> {
    const log = this.auditLogRepository.create({
      entityType: params.entityType,
      entityId: params.entityId,
      entityNumber: params.entityNumber,
      action: params.action,
      description: params.description,
      operatorId: params.user.userId,
      operatorName: params.user.userName,
      operatorRole: params.user.role,
      sourceIp: params.sourceIp || 'unknown',
      userAgent: params.userAgent,
      beforeData: params.beforeData,
      afterData: params.afterData,
      requestData: params.requestData,
      remarks: params.remarks,
    });

    return this.auditLogRepository.save(log);
  }

  async findByEntity(
    entityType: EntityType,
    entityId: string,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByOperator(operatorId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { operatorId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByTimeRange(startTime: Date, endTime: Date): Promise<AuditLog[]> {
    return this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.createdAt >= :startTime', { startTime })
      .andWhere('log.createdAt <= :endTime', { endTime })
      .orderBy('log.createdAt', 'DESC')
      .getMany();
  }
}
