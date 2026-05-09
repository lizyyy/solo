import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsOrder } from 'typeorm';
import { AuditLog, AuditAction, AuditEntityType } from './audit-log.entity';
import { v4 as uuidv4 } from 'uuid';

interface LogOptions {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  userId?: string;
  groupId?: string;
  billId?: string;
  oldValue?: any;
  newValue?: any;
  requestId?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(options: LogOptions): Promise<AuditLog> {
    const log = this.auditLogRepository.create({
      id: uuidv4(),
      action: options.action,
      entityType: options.entityType,
      entityId: options.entityId,
      userId: options.userId,
      groupId: options.groupId,
      billId: options.billId,
      oldValue: options.oldValue,
      newValue: options.newValue,
      requestId: options.requestId,
    });

    try {
      return await this.auditLogRepository.save(log);
    } catch (error) {
      console.error('保存审计日志失败:', error);
      return log;
    }
  }

  async findByGroup(
    groupId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;
    const [logs, total] = await this.auditLogRepository.findAndCount({
      where: { groupId },
      order: { createdAt: 'DESC' as FindOptionsOrder<AuditLog> },
      skip,
      take: limit,
    });

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByBill(
    billId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;
    const [logs, total] = await this.auditLogRepository.findAndCount({
      where: { billId },
      order: { createdAt: 'DESC' as FindOptionsOrder<AuditLog> },
      skip,
      take: limit,
    });

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByUser(
    userId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;
    const [logs, total] = await this.auditLogRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' as FindOptionsOrder<AuditLog> },
      skip,
      take: limit,
    });

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
