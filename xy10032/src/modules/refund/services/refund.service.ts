import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Refund } from '../refund.entity';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { UpdateRefundDto } from '../dto/update-refund.dto';
import { QueryRefundDto } from '../dto/query-refund.dto';
import { StatusTransitionDto } from '../dto/status-transition.dto';
import {
  RefundStatus,
  RefundStatusTransitions,
} from '../../../common/enums/refund-status.enum';
import { ActionType } from '../../../common/enums/action-type.enum';
import { LogLevel } from '../../../common/enums/log-level.enum';
import { Role } from '../../../common/enums/role.enum';
import {
  InvalidStatusTransitionException,
  DuplicateRefundException,
  RefundNotFoundException,
  PermissionDeniedException,
} from '../../../common/exceptions/business.exception';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { RefundHistoryService } from './refund-history.service';
import { StateMachineService } from './state-machine.service';
import { PaymentGatewayService } from './payment-gateway.service';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectRepository(Refund)
    private refundRepository: Repository<Refund>,
    private dataSource: DataSource,
    private auditLogService: AuditLogService,
    private refundHistoryService: RefundHistoryService,
    private stateMachineService: StateMachineService,
    private paymentGatewayService: PaymentGatewayService,
  ) {}

  generateRefundNo(): string {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `RF${dateStr}${random}`;
  }

  async create(
    createRefundDto: CreateRefundDto,
    userId: string,
    username: string,
  ): Promise<Refund> {
    const existingRefunds = await this.refundRepository.find({
      where: {
        orderNo: createRefundDto.orderNo,
        status: In([RefundStatus.SUCCESS, RefundStatus.PROCESSING, RefundStatus.PENDING]),
      },
    });

    if (existingRefunds.length > 0) {
      throw new DuplicateRefundException(createRefundDto.orderNo);
    }

    const refund = this.refundRepository.create({
      ...createRefundDto,
      refundNo: this.generateRefundNo(),
      createdById: userId,
      status: RefundStatus.DRAFT,
    });

    const savedRefund = await this.refundRepository.save(refund);

    await this.auditLogService.create({
      level: LogLevel.INFO,
      actionType: ActionType.CREATE,
      entityType: 'Refund',
      entityId: savedRefund.id,
      performedById: userId,
      performedByUsername: username,
      description: `Created refund ${savedRefund.refundNo} for order ${savedRefund.orderNo}`,
      details: {
        refundNo: savedRefund.refundNo,
        orderNo: savedRefund.orderNo,
        amount: savedRefund.amount,
        status: savedRefund.status,
      },
    });

    return savedRefund;
  }

  async findAll(query: QueryRefundDto): Promise<{
    items: Refund[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.refundRepository
      .createQueryBuilder('refund')
      .leftJoinAndSelect('refund.createdBy', 'createdBy')
      .orderBy('refund.createdAt', 'DESC');

    if (query.refundNo) {
      queryBuilder.andWhere('refund.refundNo LIKE :refundNo', {
        refundNo: `%${query.refundNo}%`,
      });
    }
    if (query.orderNo) {
      queryBuilder.andWhere('refund.orderNo LIKE :orderNo', { orderNo: `%${query.orderNo}%` });
    }
    if (query.status) {
      queryBuilder.andWhere('refund.status = :status', { status: query.status });
    }
    if (query.createdById) {
      queryBuilder.andWhere('refund.createdById = :createdById', {
        createdById: query.createdById,
      });
    }
    if (query.startDate) {
      queryBuilder.andWhere('refund.createdAt >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      queryBuilder.andWhere('refund.createdAt <= :endDate', { endDate: query.endDate });
    }

    const [items, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<Refund> {
    const refund = await this.refundRepository.findOne({
      where: { id },
      relations: ['createdBy', 'histories', 'auditLogs'],
    });
    if (!refund) {
      throw new RefundNotFoundException(id);
    }
    return refund;
  }

  async update(
    id: string,
    updateRefundDto: UpdateRefundDto,
    userId: string,
    username: string,
    userRole: Role,
  ): Promise<Refund> {
    const refund = await this.findOne(id);

    if (refund.status !== RefundStatus.DRAFT) {
      throw new InvalidStatusTransitionException(refund.status, 'UPDATE');
    }

    if (refund.createdById !== userId && userRole === Role.OPERATOR) {
      throw new PermissionDeniedException();
    }

    const previousData = {
      amount: refund.amount,
      reason: refund.reason,
      remark: refund.remark,
      refundMethod: refund.refundMethod,
      currency: refund.currency,
    };

    Object.assign(refund, updateRefundDto);

    const savedRefund = await this.refundRepository.save(refund);

    await this.refundHistoryService.createHistory(
      savedRefund,
      previousData,
      userId,
      username,
      'Updated refund details',
    );

    await this.auditLogService.create({
      level: LogLevel.INFO,
      actionType: ActionType.UPDATE,
      entityType: 'Refund',
      entityId: id,
      performedById: userId,
      performedByUsername: username,
      description: `Updated refund ${refund.refundNo}`,
      details: { updateRefundDto },
    });

    return savedRefund;
  }

  async transitionStatus(
    id: string,
    dto: StatusTransitionDto,
    userId: string,
    username: string,
    userRole: Role,
  ): Promise<Refund> {
    const refund = await this.findOne(id);

    this.stateMachineService.validateTransition(refund.status, dto.targetStatus);

    if (dto.targetStatus === RefundStatus.PROCESSING && userRole === Role.OPERATOR) {
      throw new PermissionDeniedException();
    }

    if (dto.targetStatus === RefundStatus.REJECTED && userRole === Role.OPERATOR) {
      throw new PermissionDeniedException();
    }

    const previousData = {
      status: refund.status,
      remark: refund.remark,
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      refund.status = dto.targetStatus;

      if (dto.remark) {
        refund.remark = dto.remark;
      }

      if (dto.targetStatus === RefundStatus.PROCESSING) {
        refund.approvedById = userId;
      }

      if (dto.targetStatus === RefundStatus.RETRYING) {
        refund.retryCount += 1;
        refund.lastRetryAt = new Date();
      }

      const savedRefund = await queryRunner.manager.save(refund);

      await this.refundHistoryService.createHistory(
        savedRefund,
        previousData,
        userId,
        username,
        `Status changed from ${this.stateMachineService.getStatusDescription(previousData.status as RefundStatus)} to ${this.stateMachineService.getStatusDescription(dto.targetStatus)}`,
      );

      await this.auditLogService.create({
        level: LogLevel.INFO,
        actionType: this.getActionTypeForStatusTransition(dto.targetStatus),
        entityType: 'Refund',
        entityId: id,
        performedById: userId,
        performedByUsername: username,
        description: `Refund ${savedRefund.refundNo} status changed to ${dto.targetStatus}`,
        details: {
          from: previousData.status,
          to: dto.targetStatus,
          reason: dto.reason,
        },
      });

      await queryRunner.commitTransaction();

      if (dto.targetStatus === RefundStatus.PROCESSING) {
        await this.processRefundAsync(savedRefund, userId, username);
      }

      return savedRefund;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private getActionTypeForStatusTransition(status: RefundStatus): ActionType {
    const mapping: Partial<Record<RefundStatus, ActionType>> = {
      [RefundStatus.PENDING]: ActionType.SUBMIT,
      [RefundStatus.PROCESSING]: ActionType.APPROVE,
      [RefundStatus.REJECTED]: ActionType.REJECT,
      [RefundStatus.CANCELLED]: ActionType.CANCEL,
      [RefundStatus.SUCCESS]: ActionType.SUCCESS,
      [RefundStatus.FAILED]: ActionType.FAIL,
      [RefundStatus.RETRYING]: ActionType.RETRY,
    };
    return mapping[status] || ActionType.UPDATE;
  }

  async processRefundAsync(
    refund: Refund,
    userId: string,
    username: string,
  ): Promise<void> {
    setTimeout(async () => {
      try {
        const result = await this.paymentGatewayService.processRefund(
          refund.id,
          refund.amount,
          refund.orderNo,
        );

        const targetStatus = result.success ? RefundStatus.SUCCESS : RefundStatus.FAILED;

        const updatedRefund = await this.refundRepository.findOne({ where: { id: refund.id } });
        updatedRefund.status = targetStatus;
        updatedRefund.gatewayTransactionId = result.transactionId;
        updatedRefund.gatewayResponse = JSON.stringify(result.response);

        const previousData = { status: RefundStatus.PROCESSING };
        await this.refundHistoryService.createHistory(
          updatedRefund,
          previousData,
          userId,
          username,
          result.success ? 'Refund processed successfully by gateway' : 'Refund processing failed',
        );

        await this.refundRepository.save(updatedRefund);

        await this.auditLogService.create({
          level: result.success ? LogLevel.INFO : LogLevel.ERROR,
          actionType: result.success ? ActionType.SUCCESS : ActionType.FAIL,
          entityType: 'Refund',
          entityId: refund.id,
          performedById: userId,
          performedByUsername: username,
          description: `Refund ${updatedRefund.refundNo} ${result.success ? 'processed successfully' : 'failed'}`,
          details: result.response,
        });
      } catch (error) {
        this.logger.error(`Failed to process refund ${refund.id}: ${error.message}`, error.stack);

        const updatedRefund = await this.refundRepository.findOne({ where: { id: refund.id } });
        updatedRefund.status = RefundStatus.FAILED;
        updatedRefund.gatewayResponse = JSON.stringify({ error: error.message });

        await this.refundRepository.save(updatedRefund);

        await this.auditLogService.create({
          level: LogLevel.ERROR,
          actionType: ActionType.FAIL,
          entityType: 'Refund',
          entityId: refund.id,
          performedById: userId,
          performedByUsername: username,
          description: `Refund ${updatedRefund.refundNo} failed with error`,
          errorMessage: error.message,
          stackTrace: error.stack,
        });
      }
    }, 100);
  }

  async retryRefund(
    id: string,
    userId: string,
    username: string,
  ): Promise<Refund> {
    return this.transitionStatus(
      id,
      { targetStatus: RefundStatus.RETRYING },
      userId,
      username,
      Role.ADMIN,
    );
  }

  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<RefundStatus, number>;
    totalAmount: number;
    successAmount: number;
  }> {
    const statusCounts: Record<RefundStatus, number> = {} as Record<RefundStatus, number>;
    Object.values(RefundStatus).forEach((status) => {
      statusCounts[status] = 0;
    });

    const refunds = await this.refundRepository.find();
    let totalAmount = 0;
    let successAmount = 0;

    for (const refund of refunds) {
      statusCounts[refund.status] = (statusCounts[refund.status] || 0) + 1;
      totalAmount += Number(refund.amount);
      if (refund.status === RefundStatus.SUCCESS) {
        successAmount += Number(refund.amount);
      }
    }

    return {
      total: refunds.length,
      byStatus: statusCounts,
      totalAmount,
      successAmount,
    };
  }
}
