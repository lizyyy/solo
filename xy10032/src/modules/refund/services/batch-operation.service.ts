import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Refund } from '../refund.entity';
import { RefundService } from './refund.service';
import { BatchOperationDto, BatchStatusChangeDto } from '../dto/batch-operation.dto';
import { RefundStatus } from '../../../common/enums/refund-status.enum';
import { ActionType } from '../../../common/enums/action-type.enum';
import { LogLevel } from '../../../common/enums/log-level.enum';
import { Role } from '../../../common/enums/role.enum';
import { AuditLogService } from '../../audit-log/audit-log.service';

@Injectable()
export class BatchOperationService {
  private readonly logger = new Logger(BatchOperationService.name);

  constructor(
    @InjectRepository(Refund)
    private refundRepository: Repository<Refund>,
    private refundService: RefundService,
    private auditLogService: AuditLogService,
  ) {}

  async batchStatusChange(
    dto: BatchStatusChangeDto,
    userId: string,
    username: string,
    userRole: Role,
  ): Promise<{
    successCount: number;
    failedCount: number;
    results: Array<{
      refundId: string;
      refundNo: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const refundId of dto.refundIds) {
      try {
        const refund = await this.refundService.transitionStatus(
          refundId,
          { targetStatus: dto.targetStatus, reason: dto.reason },
          userId,
          username,
          userRole,
        );
        successCount++;
        results.push({
          refundId,
          refundNo: refund.refundNo,
          success: true,
        });
      } catch (error) {
        failedCount++;
        results.push({
          refundId,
          success: false,
          error: error.message,
        });
        this.logger.warn(`Batch operation failed for refund ${refundId}: ${error.message}`);
      }
    }

    await this.auditLogService.create({
      level: LogLevel.INFO,
      actionType: ActionType.BATCH_UPDATE,
      entityType: 'Refund',
      performedById: userId,
      performedByUsername: username,
      description: `Batch status change to ${dto.targetStatus}: ${successCount} success, ${failedCount} failed`,
      details: {
        targetStatus: dto.targetStatus,
        totalRefunds: dto.refundIds.length,
        successCount,
        failedCount,
        refundIds: dto.refundIds,
      },
    });

    return {
      successCount,
      failedCount,
      results,
    };
  }

  async batchCancel(
    dto: BatchOperationDto,
    userId: string,
    username: string,
    userRole: Role,
  ): Promise<any> {
    return this.batchStatusChange(
      { ...dto, targetStatus: RefundStatus.CANCELLED },
      userId,
      username,
      userRole,
    );
  }

  async batchApprove(
    dto: BatchOperationDto,
    userId: string,
    username: string,
    userRole: Role,
  ): Promise<any> {
    return this.batchStatusChange(
      { ...dto, targetStatus: RefundStatus.PROCESSING },
      userId,
      username,
      userRole,
    );
  }

  async batchRetry(
    dto: BatchOperationDto,
    userId: string,
    username: string,
    userRole: Role,
  ): Promise<any> {
    return this.batchStatusChange(
      { ...dto, targetStatus: RefundStatus.RETRYING },
      userId,
      username,
      userRole,
    );
  }
}
