import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Bin, BinStatus, BinEvent, BinEventType, EventLevel, EventStatus } from '../entities';
import { AppDataSource } from '../database/data-source';
import { BizResponse, success, idempotent, invalidParam, notFound, businessError } from '../utils/biz-response';
import { IdempotentService } from './idempotent.service';
import { BackgroundJobService, JobType } from './background-job.service';

export interface ReportEventDto {
  requestId: string;
  binId: string;
  eventType: BinEventType;
  fillLevel?: number;
  source?: string;
  description?: string;
}

export class BinEventService {
  private binRepo: Repository<Bin>;
  private eventRepo: Repository<BinEvent>;
  private idempotentService: IdempotentService;
  private jobService: BackgroundJobService;

  constructor() {
    this.binRepo = AppDataSource.getRepository(Bin);
    this.eventRepo = AppDataSource.getRepository(BinEvent);
    this.idempotentService = new IdempotentService();
    this.jobService = new BackgroundJobService();
  }

  private calcBinStatus(fillLevel: number): BinStatus {
    if (fillLevel >= 100) return BinStatus.OVERFLOW;
    if (fillLevel >= 85) return BinStatus.FULL;
    if (fillLevel >= 70) return BinStatus.NEAR_FULL;
    return BinStatus.NORMAL;
  }

  private calcEventLevel(eventType: BinEventType, fillLevel?: number): EventLevel {
    if (eventType === BinEventType.OVERFLOW_ALERT) return EventLevel.CRITICAL;
    if (eventType === BinEventType.FULL_ALERT) return EventLevel.URGENT;
    if (fillLevel !== undefined && fillLevel >= 85) return EventLevel.WARNING;
    return EventLevel.INFO;
  }

  async reportEvent(dto: ReportEventDto): Promise<BizResponse> {
    if (!dto.requestId) {
      return invalidParam('必须提供 requestId（幂等请求ID）');
    }
    if (!dto.binId) {
      return invalidParam('必须提供桶点ID');
    }
    if (!dto.eventType) {
      return invalidParam('必须提供事件类型');
    }

    const bizType = 'BIN_EVENT_REPORT';
    const { reserved, existing } = await this.idempotentService.checkOrReserve(
      bizType,
      dto.requestId,
      JSON.stringify(dto),
    );

    const bin = await this.binRepo.findOne({ where: { id: dto.binId } });
    if (!bin) {
      if (reserved) await this.idempotentService.markFailed(bizType, dto.requestId);
      return notFound(`未找到桶点 ${dto.binId}`);
    }

    if (!reserved && existing) {
      if (existing.status === 'SUCCESS' && existing.responseSnapshot) {
        const savedData = JSON.parse(existing.responseSnapshot);
        return idempotent(savedData, '该事件已上报（重复请求）');
      }
      if (existing.status === 'FAILED') {
        return businessError('上次上报失败，请使用新的 requestId 重试');
      }
      return idempotent({ eventId: existing.bizId }, '该事件正在处理或已处理');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newStatus = dto.fillLevel !== undefined ? this.calcBinStatus(dto.fillLevel) : bin.status;
      const level = this.calcEventLevel(dto.eventType, dto.fillLevel);

      let consecutiveFullCount = bin.consecutiveFullCount;
      let isUrgent = bin.isUrgent;
      let lastFullAt = bin.lastFullAt;

      if (
        dto.eventType === BinEventType.FULL_ALERT ||
        dto.eventType === BinEventType.OVERFLOW_ALERT ||
        (dto.fillLevel !== undefined && dto.fillLevel >= 85)
      ) {
        consecutiveFullCount = bin.consecutiveFullCount + 1;
        isUrgent = true;
        lastFullAt = new Date();
      } else if (dto.eventType === BinEventType.CLEARED) {
        consecutiveFullCount = 0;
        isUrgent = false;
      }

      bin.fillLevel = dto.fillLevel !== undefined ? dto.fillLevel : bin.fillLevel;
      bin.status = newStatus;
      bin.consecutiveFullCount = consecutiveFullCount;
      bin.isUrgent = isUrgent;
      bin.lastFullAt = lastFullAt;
      if (dto.eventType === BinEventType.CLEARED) {
        bin.lastClearedAt = new Date();
      }

      await queryRunner.manager.save(bin);

      const event = queryRunner.manager.create(BinEvent, {
        requestId: dto.requestId,
        binId: bin.id,
        eventType: dto.eventType,
        level,
        status: level === EventLevel.INFO ? EventStatus.RESOLVED : EventStatus.PENDING,
        fillLevel: dto.fillLevel ?? null,
        binStatusAtReport: newStatus,
        binTypeAtReport: bin.binType,
        source: dto.source || '传感器',
        description: dto.description || null,
        resolvedAt: level === EventLevel.INFO ? new Date() : null,
      });

      const savedEvent = await queryRunner.manager.save(event);

      await queryRunner.commitTransaction();

      await this.idempotentService.markSuccess(
        bizType,
        dto.requestId,
        savedEvent.id,
        JSON.stringify({ eventId: savedEvent.id }),
      );

      if (level === EventLevel.URGENT || level === EventLevel.CRITICAL) {
        await this.jobService.createJob(
          JobType.EVENT_ESCALATE,
          {
            eventId: savedEvent.id,
            binId: bin.id,
            level,
            consecutiveFullCount,
          },
          { relatedBizType: 'BinEvent', relatedBizId: savedEvent.id },
        );
      }

      const levelText = level === EventLevel.CRITICAL ? '重大' : level === EventLevel.URGENT ? '紧急' : '普通';
      const msg = `事件上报成功：${bin.community} ${bin.location} ${bin.binType} - ${dto.eventType}（${levelText}）`;

      return success(
        {
          eventId: savedEvent.id,
          binId: bin.id,
          community: bin.community,
          location: bin.location,
          binType: bin.binType,
          eventType: dto.eventType,
          level,
          previousFillLevel: bin.fillLevel - (dto.fillLevel !== undefined ? 0 : 0),
          currentFillLevel: bin.fillLevel,
          currentStatus: bin.status,
          isUrgent: bin.isUrgent,
          consecutiveFullCount: bin.consecutiveFullCount,
        },
        msg,
      );
    } catch (e: any) {
      await queryRunner.rollbackTransaction();
      await this.idempotentService.markFailed(bizType, dto.requestId);
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async getEvents(binId?: string, status?: EventStatus, limit: number = 20): Promise<BizResponse> {
    const where: any = {};
    if (binId) where.binId = binId;
    if (status) where.status = status;

    const events = await this.eventRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return success({
      total: events.length,
      events: events.map((e) => ({
        id: e.id,
        binId: e.binId,
        eventType: e.eventType,
        level: e.level,
        status: e.status,
        fillLevel: e.fillLevel,
        source: e.source,
        description: e.description,
        createdAt: e.createdAt,
      })),
    }, `共查询到 ${events.length} 条事件`);
  }

  async resolveEvent(eventId: string, handler: string, remark?: string): Promise<BizResponse> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) {
      return notFound('未找到该事件');
    }
    if (event.status === EventStatus.RESOLVED) {
      return idempotent({ eventId }, '该事件已经处理完成');
    }

    event.status = EventStatus.RESOLVED;
    event.handler = handler;
    event.handleRemark = remark || null;
    event.resolvedAt = new Date();
    await this.eventRepo.save(event);

    if (event.binId) {
      await this.binRepo.update(
        { id: event.binId },
        { isUrgent: false, consecutiveFullCount: 0 },
      );
    }

    return success(
      { eventId, status: EventStatus.RESOLVED, resolvedAt: event.resolvedAt },
      `事件已处理：${handler} 完成对 ${event.eventType} 的处理`,
    );
  }
}
