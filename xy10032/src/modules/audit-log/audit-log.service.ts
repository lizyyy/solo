import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { LogLevel } from '../../common/enums/log-level.enum';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async create(dto: CreateAuditLogDto): Promise<AuditLog> {
    try {
      const log = this.auditLogRepository.create(dto);
      return await this.auditLogRepository.save(log);
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(filters?: {
    level?: LogLevel;
    actionType?: string;
    entityType?: string;
    entityId?: string;
    performedById?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AuditLog[]> {
    const queryBuilder = this.auditLogRepository.createQueryBuilder('log');

    if (filters?.level) {
      queryBuilder.andWhere('log.level = :level', { level: filters.level });
    }
    if (filters?.actionType) {
      queryBuilder.andWhere('log.actionType = :actionType', { actionType: filters.actionType });
    }
    if (filters?.entityType) {
      queryBuilder.andWhere('log.entityType = :entityType', { entityType: filters.entityType });
    }
    if (filters?.entityId) {
      queryBuilder.andWhere('log.entityId = :entityId', { entityId: filters.entityId });
    }
    if (filters?.performedById) {
      queryBuilder.andWhere('log.performedById = :performedById', {
        performedById: filters.performedById,
      });
    }
    if (filters?.startDate) {
      queryBuilder.andWhere('log.createdAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      queryBuilder.andWhere('log.createdAt <= :endDate', { endDate: filters.endDate });
    }

    return queryBuilder
      .orderBy('log.createdAt', 'DESC')
      .take(500)
      .getMany();
  }

  async findById(id: string): Promise<AuditLog> {
    return this.auditLogRepository.findOne({ where: { id } });
  }

  async findByRefundId(refundId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { entityType: 'Refund', entityId: refundId },
      order: { createdAt: 'DESC' },
    });
  }
}
