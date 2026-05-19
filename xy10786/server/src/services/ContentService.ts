import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../database';
import { ContentEntity } from '../entities/ContentEntity';
import { ChannelSyncEntity } from '../entities/ChannelSyncEntity';
import { ReviewRecordEntity } from '../entities/ReviewRecordEntity';
import { ContentStatus, ChannelType, ReviewAction, DashboardStats, TimelineItem, CalendarEvent } from '../types';
import { StateMachineService } from './StateMachineService';

export class ContentService {
  private contentRepo: Repository<ContentEntity>;
  private channelRepo: Repository<ChannelSyncEntity>;
  private reviewRepo: Repository<ReviewRecordEntity>;

  constructor() {
    this.contentRepo = AppDataSource.getRepository(ContentEntity);
    this.channelRepo = AppDataSource.getRepository(ChannelSyncEntity);
    this.reviewRepo = AppDataSource.getRepository(ReviewRecordEntity);
  }

  private async addTimelineRecord(contentId: string, action: string, operator: string, details: any = {}) {
    const record = this.reviewRepo.create({
      contentId,
      action,
      reviewer: operator,
      reason: details.reason || details.message || '',
      remark: details.remark || JSON.stringify(details)
    });
    await this.reviewRepo.save(record);
  }

  async createContent(data: {
    title: string;
    content: string;
    author: string;
    scheduledAt?: Date;
    channels?: ChannelType[];
    idempotencyKey?: string;
  }) {
    const idempotencyKey = data.idempotencyKey || uuidv4();
    
    const existing = await this.contentRepo.findOne({ where: { idempotencyKey } });
    if (existing) {
      return { content: existing, isNew: false };
    }

    const content = this.contentRepo.create({
      title: data.title,
      content: data.content,
      author: data.author,
      scheduledAt: data.scheduledAt || null,
      idempotencyKey,
      status: data.scheduledAt ? ContentStatus.SCHEDULED : ContentStatus.DRAFT,
      channels: (data.channels || []).map(channel => 
        this.channelRepo.create({
          channel,
          status: data.scheduledAt ? ContentStatus.SCHEDULED : ContentStatus.DRAFT
        })
      )
    });

    const saved = await this.contentRepo.save(content);
    return { content: saved, isNew: true };
  }

  async getContent(id: string) {
    return this.contentRepo.findOne({
      where: { id },
      relations: ['channels', 'reviewHistory']
    });
  }

  async getContentList(params: {
    status?: ContentStatus;
    page?: number;
    pageSize?: number;
  }) {
    const { status, page = 1, pageSize = 20 } = params;
    const where = status ? { status } : {};
    
    const [list, total] = await this.contentRepo.findAndCount({
      where,
      relations: ['channels'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    return { list, total, page, pageSize };
  }

  async updateContent(id: string, data: {
    title?: string;
    content?: string;
    scheduledAt?: Date;
    channels?: ChannelType[];
  }) {
    const content = await this.getContent(id);
    if (!content) return null;

    if (data.title) content.title = data.title;
    if (data.content) content.content = data.content;
    
    if (data.scheduledAt) {
      content.scheduledAt = data.scheduledAt;
      if (content.status === ContentStatus.APPROVED) {
        content.status = ContentStatus.SCHEDULED;
      }
      await this.syncChannelSchedules(id, data.scheduledAt);
    }

    if (data.channels) {
      await this.updateChannels(id, data.channels);
    }

    content.version += 1;
    return this.contentRepo.save(content);
  }

  private async updateChannels(contentId: string, channels: ChannelType[]) {
    const existing = await this.channelRepo.find({ where: { contentId } });
    const existingChannels = existing.map(c => c.channel);
    
    const toRemove = existing.filter(c => !channels.includes(c.channel));
    const toAdd = channels.filter(c => !existingChannels.includes(c));

    if (toRemove.length > 0) {
      await this.channelRepo.remove(toRemove);
    }

    if (toAdd.length > 0) {
      const newChannels = toAdd.map(channel => 
        this.channelRepo.create({
          contentId,
          channel,
          status: ContentStatus.DRAFT
        })
      );
      await this.channelRepo.save(newChannels);
    }
  }

  private async syncChannelSchedules(contentId: string, scheduledAt: Date) {
    const channels = await this.channelRepo.find({ where: { contentId } });
    for (const channel of channels) {
      if (channel.status === ContentStatus.APPROVED) {
        channel.status = ContentStatus.SCHEDULED;
      }
    }
    await this.channelRepo.save(channels);
  }

  async submitForReview(id: string, reviewer: string) {
    const content = await this.getContent(id);
    if (!content) return null;

    const validation = StateMachineService.validateTransition(content, ContentStatus.PENDING_REVIEW);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    content.status = ContentStatus.PENDING_REVIEW;
    content.version += 1;
    
    await this.addTimelineRecord(id, 'Submitted for Review', reviewer, {
      version: content.version,
      message: 'Content submitted for review'
    });

    return this.contentRepo.save(content);
  }

  async reviewContent(id: string, action: ReviewAction, reviewer: string, reason: string, remark?: string) {
    const content = await this.getContent(id);
    if (!content) return null;

    const nextStatus = StateMachineService.getStatusForReviewAction(action);
    const validation = StateMachineService.validateTransition(content, nextStatus);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    content.status = nextStatus;
    content.version += 1;

    const reviewRecord = this.reviewRepo.create({
      contentId: id,
      action,
      reviewer,
      reason,
      remark: remark || ''
    });

    await this.reviewRepo.save(reviewRecord);

    if (nextStatus === ContentStatus.APPROVED && content.scheduledAt) {
      content.status = ContentStatus.SCHEDULED;
      for (const channel of content.channels) {
        channel.status = ContentStatus.SCHEDULED;
      }
    }

    if (nextStatus === ContentStatus.NEEDS_REVIEW) {
      for (const channel of content.channels) {
        if (channel.status !== ContentStatus.FAILED) {
          channel.status = ContentStatus.NEEDS_REVIEW;
        }
      }
    }

    return this.contentRepo.save(content);
  }

  async retryPublish(id: string) {
    const content = await this.getContent(id);
    if (!content) return null;

    if (!StateMachineService.canRetry(content)) {
      throw new Error('Max retries reached or invalid status for retry');
    }

    content.retryCount += 1;
    content.status = ContentStatus.PUBLISHING;
    content.version += 1;

    await this.contentRepo.save(content);
    await this.addTimelineRecord(id, 'Retry Publish', 'system', {
      retryCount: content.retryCount,
      maxRetries: content.maxRetries,
      message: 'Starting publish retry'
    });

    await this.simulatePublish(content, id);

    return this.getContent(id);
  }

  async retryChannelSync(channelId: string) {
    const channel = await this.channelRepo.findOne({ where: { id: channelId } });
    if (!channel) return null;

    if (!StateMachineService.canChannelRetry(channel)) {
      throw new Error('Max retries reached or invalid status for retry');
    }

    channel.retryCount += 1;
    channel.status = ContentStatus.SYNCING;
    await this.channelRepo.save(channel);

    await this.addTimelineRecord(channel.contentId, `Channel ${channel.channel} Retry Sync`, 'system', {
      channel: channel.channel,
      retryCount: channel.retryCount,
      maxRetries: channel.maxRetries,
      message: 'Starting channel sync retry'
    });

    await this.simulateChannelSync(channel, channel.contentId);

    return this.channelRepo.findOne({ where: { id: channelId } });
  }

  private async simulatePublish(content: ContentEntity, contentId: string) {
    setTimeout(async () => {
      const shouldFail = Math.random() < 0.2;
      
      if (shouldFail) {
        if (content.retryCount < content.maxRetries) {
          content.status = ContentStatus.RETRYABLE;
          await this.addTimelineRecord(contentId, 'Publish Failed (Retryable)', 'system', {
            message: 'Publish failed but can retry',
            retryCount: content.retryCount,
            remainingRetries: content.maxRetries - content.retryCount
          });
        } else {
          content.status = ContentStatus.FAILED;
          await this.addTimelineRecord(contentId, 'Publish Failed', 'system', {
            message: 'Max retries reached, publish failed',
            retryCount: content.retryCount
          });
        }
      } else {
        content.status = ContentStatus.PUBLISHED;
        content.publishedAt = new Date();
        await this.addTimelineRecord(contentId, 'Published', 'system', {
          message: 'Content published successfully',
          publishedAt: content.publishedAt.toISOString()
        });
        
        for (const channel of content.channels) {
          channel.status = ContentStatus.SYNCING;
          await this.channelRepo.save(channel);
          this.simulateChannelSync(channel, contentId);
        }
      }
      
      await this.contentRepo.save(content);
    }, 2000);
  }

  private async simulateChannelSync(channel: ChannelSyncEntity, contentId: string) {
    setTimeout(async () => {
      const shouldFail = Math.random() < 0.3;
      
      if (shouldFail) {
        if (channel.retryCount < channel.maxRetries) {
          channel.status = ContentStatus.RETRYABLE;
          channel.errorMessage = `Channel sync failed at ${new Date().toISOString()}`;
          await this.addTimelineRecord(contentId, `Channel ${channel.channel} Sync Failed (Retryable)`, 'system', {
            channel: channel.channel,
            message: channel.errorMessage,
            retryCount: channel.retryCount,
            remainingRetries: channel.maxRetries - channel.retryCount
          });
        } else {
          channel.status = ContentStatus.FAILED;
          channel.errorMessage = `Channel sync failed at ${new Date().toISOString()} - Max retries reached`;
          await this.addTimelineRecord(contentId, `Channel ${channel.channel} Sync Failed`, 'system', {
            channel: channel.channel,
            message: channel.errorMessage,
            retryCount: channel.retryCount
          });
        }
      } else {
        channel.status = ContentStatus.SYNCED;
        channel.syncedAt = new Date();
        channel.externalId = `ext_${uuidv4().slice(0, 8)}`;
        await this.addTimelineRecord(contentId, `Channel ${channel.channel} Synced`, 'system', {
          channel: channel.channel,
          message: 'Sync completed successfully',
          syncedAt: channel.syncedAt.toISOString(),
          externalId: channel.externalId
        });
      }
      
      await this.channelRepo.save(channel);
    }, 3000);
  }

  async processScheduledContent() {
    const now = new Date();
    const scheduled = await this.contentRepo.find({
      where: { status: ContentStatus.SCHEDULED },
      relations: ['channels']
    });

    for (const content of scheduled) {
      if (content.scheduledAt && content.scheduledAt <= now) {
        content.status = ContentStatus.PUBLISHING;
        content.publishedAt = now;
        await this.contentRepo.save(content);
        await this.addTimelineRecord(content.id, 'Scheduled Publish Started', 'system', {
          scheduledAt: content.scheduledAt.toISOString(),
          message: 'Starting scheduled publish'
        });
        
        for (const channel of content.channels) {
          channel.status = ContentStatus.SYNCING;
          await this.channelRepo.save(channel);
        }

        await this.simulatePublish(content, content.id);
      }
    }
  }

  async processPublishingContent() {
    const publishing = await this.contentRepo.find({
      where: { status: ContentStatus.PUBLISHING },
      relations: ['channels']
    });

    for (const content of publishing) {
      await this.simulatePublish(content, content.id);
    }
  }

  async processSyncingChannels() {
    const syncing = await this.channelRepo.find({
      where: { status: ContentStatus.SYNCING },
      relations: ['content']
    });

    for (const channel of syncing) {
      await this.simulateChannelSync(channel, channel.contentId);
    }
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const [list] = await this.contentRepo.findAndCount();
    
    return {
      total: list.length,
      draft: list.filter(c => c.status === ContentStatus.DRAFT).length,
      pendingReview: list.filter(c => c.status === ContentStatus.PENDING_REVIEW).length,
      scheduled: list.filter(c => c.status === ContentStatus.SCHEDULED).length,
      published: list.filter(c => c.status === ContentStatus.PUBLISHED || c.status === ContentStatus.SYNCED).length,
      failed: list.filter(c => c.status === ContentStatus.FAILED).length,
      needsReview: list.filter(c => c.status === ContentStatus.NEEDS_REVIEW).length
    };
  }

  async getTimeline(contentId: string): Promise<TimelineItem[]> {
    const content = await this.getContent(contentId);
    if (!content) return [];

    const timeline: TimelineItem[] = [];

    timeline.push({
      id: uuidv4(),
      contentId,
      action: '创建',
      operator: content.author,
      timestamp: content.createdAt,
      details: { title: content.title }
    });

    for (const review of content.reviewHistory) {
      timeline.push({
        id: review.id,
        contentId,
        action: review.action,
        operator: review.reviewer,
        timestamp: review.createdAt,
        details: { reason: review.reason, remark: review.remark }
      });
    }

    return timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getCalendar(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const contentList = await this.contentRepo
      .createQueryBuilder('content')
      .leftJoinAndSelect('content.channels', 'channels')
      .where('content.scheduledAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getMany();

    return contentList.map(content => ({
      id: content.id,
      title: content.title,
      start: content.scheduledAt!,
      end: content.scheduledAt!,
      status: content.status,
      channels: content.channels.map(c => c.channel)
    }));
  }

  async fixChannelSync(channelId: string, correction: string, operator: string) {
    const channel = await this.channelRepo.findOne({ where: { id: channelId } });
    if (!channel) return null;

    channel.errorMessage = `${channel.errorMessage || ''}\n[修正记录 - ${operator}]: ${correction}`;
    channel.status = ContentStatus.RETRYABLE;
    channel.retryCount = 0;

    await this.addTimelineRecord(channel.contentId, `Channel ${channel.channel} Fixed`, operator, {
      channel: channel.channel,
      correction,
      message: 'Channel sync issue fixed, retries reset'
    });

    return this.channelRepo.save(channel);
  }

  async simulatePublishNow(id: string) {
    const content = await this.getContent(id);
    if (!content) return null;

    if (content.status !== ContentStatus.SCHEDULED && content.status !== ContentStatus.APPROVED) {
      throw new Error('Content not in schedulable state');
    }

    content.status = ContentStatus.PUBLISHING;
    content.publishedAt = new Date();
    content.version += 1;

    await this.addTimelineRecord(id, 'Manual Publish Started', 'admin', {
      scheduledAt: content.scheduledAt?.toISOString(),
      publishedAt: content.publishedAt.toISOString(),
      message: 'Manual publish triggered'
    });

    for (const channel of content.channels) {
      channel.status = ContentStatus.SYNCING;
      await this.channelRepo.save(channel);
    }

    await this.contentRepo.save(content);
    await this.simulatePublish(content, id);

    return this.getContent(id);
  }
}
