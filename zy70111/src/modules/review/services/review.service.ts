import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ReviewTask } from '../entities/review-task.entity';
import {
  ReviewStatus,
  ReviewPriority,
  ProcessingResult,
  UserContext,
  PaginatedResult,
  EntityType,
} from '../../../common/types';
import { CreateReviewTaskDto, ResolveReviewTaskDto, ReviewQueryDto } from '../dto/review.dto';
import { FlowHistoryService } from '../../history/services/flow-history.service';
import { AuditLogService } from '../../history/services/audit-log.service';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    @InjectRepository(ReviewTask)
    private readonly reviewRepository: Repository<ReviewTask>,
    private readonly flowHistoryService: FlowHistoryService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createTask(
    dto: CreateReviewTaskDto,
    user: UserContext,
  ): Promise<ProcessingResult<ReviewTask>> {
    const task = this.reviewRepository.create({
      ...dto,
      taskNumber: `REV-${Date.now()}`,
      status: ReviewStatus.PENDING,
      priority: dto.priority || ReviewPriority.MEDIUM,
      createdBy: user.userId,
      createdByName: user.userName,
    });

    const savedTask = await this.reviewRepository.save(task);

    await this.auditLogService.log({
      entityType: EntityType.REVIEW_TASK,
      entityId: savedTask.id,
      entityNumber: savedTask.taskNumber,
      action: 'CREATE',
      description: `创建复核任务: ${dto.reasonCode}`,
      user,
      afterData: { ...savedTask },
    });

    return {
      success: true,
      data: savedTask,
      needsReview: true,
      reviewReason: dto.reasonCode,
      reviewPriority: savedTask.priority,
      message: `复核任务已创建，需要人工处理`,
    };
  }

  async resolveTask(
    dto: ResolveReviewTaskDto,
    user: UserContext,
  ): Promise<ProcessingResult<ReviewTask>> {
    const task = await this.reviewRepository.findOne({
      where: { id: dto.taskId },
    });

    if (!task) {
      throw new Error('复核任务不存在');
    }

    const beforeData = { ...task };

    task.status = dto.status || ReviewStatus.RESOLVED;
    task.conclusion = dto.conclusion;
    task.resolutionActions = dto.resolutionActions;
    task.assigneeId = user.userId;
    task.assigneeName = user.userName;
    task.assignedAt = new Date();
    task.resolvedAt = new Date();
    task.remarks = dto.remarks;

    const savedTask = await this.reviewRepository.save(task);

    await this.auditLogService.log({
      entityType: EntityType.REVIEW_TASK,
      entityId: savedTask.id,
      entityNumber: savedTask.taskNumber,
      action: 'RESOLVE',
      description: `复核任务处理完成: ${dto.conclusion}`,
      user,
      beforeData,
      afterData: { ...savedTask },
      requestData: dto,
    });

    return {
      success: true,
      data: savedTask,
      needsReview: false,
      message: '复核任务已处理完成',
    };
  }

  async findById(id: string): Promise<ReviewTask> {
    const task = await this.reviewRepository.findOne({ where: { id } });
    if (!task) {
      throw new Error('复核任务不存在');
    }
    return task;
  }

  async query(
    query: ReviewQueryDto,
  ): Promise<PaginatedResult<ReviewTask>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const qb = this.reviewRepository.createQueryBuilder('task');

    if (query.status?.length) {
      qb.andWhere('task.status IN (:...status)', { status: query.status });
    }

    if (query.priority?.length) {
      qb.andWhere('task.priority IN (:...priority)', { priority: query.priority });
    }

    if (query.reasonCode) {
      qb.andWhere('task.reasonCode = :reasonCode', { reasonCode: query.reasonCode });
    }

    if (query.certificateNumber) {
      qb.andWhere('task.certificateNumber LIKE :certNumber', {
        certNumber: `%${query.certificateNumber}%`,
      });
    }

    if (query.assigneeId) {
      qb.andWhere('task.assigneeId = :assigneeId', { assigneeId: query.assigneeId });
    }

    const [items, total] = await qb
      .orderBy('task.priority', 'DESC')
      .addOrderBy('task.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byReason: Record<string, number>;
  }> {
    const [total, statusStats, priorityStats, reasonStats] = await Promise.all([
      this.reviewRepository.count(),
      this.reviewRepository
        .createQueryBuilder('task')
        .select('task.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('task.status')
        .getRawMany(),
      this.reviewRepository
        .createQueryBuilder('task')
        .select('task.priority', 'priority')
        .addSelect('COUNT(*)', 'count')
        .groupBy('task.priority')
        .getRawMany(),
      this.reviewRepository
        .createQueryBuilder('task')
        .select('task.reasonCode', 'reasonCode')
        .addSelect('COUNT(*)', 'count')
        .groupBy('task.reasonCode')
        .getRawMany(),
    ]);

    return {
      total,
      byStatus: statusStats.reduce((acc, item) => ({ ...acc, [item.status]: Number(item.count) }), {}),
      byPriority: priorityStats.reduce((acc, item) => ({ ...acc, [item.priority]: Number(item.count) }), {}),
      byReason: reasonStats.reduce((acc, item) => ({ ...acc, [item.reasonCode]: Number(item.count) }), {}),
    };
  }

  async resolveDuplicateConflict(
    taskId: string,
    user: UserContext,
  ): Promise<ProcessingResult<ReviewTask>> {
    const task = await this.findById(taskId);
    const resolution = {
      ...task,
    };

    return this.resolveTask({
      taskId,
      conclusion: '已人工确认',
      status: ReviewStatus.RESOLVED,
    }, user);
  }
}
