import { v4 as uuidv4 } from 'uuid';
import {
  AudienceSegment,
  PublishRecord,
  StatusHistory,
  SegmentStatus,
  OperationType,
  ChannelType,
  RevokeReason
} from './types';

class DataStore {
  private segments: Map<string, AudienceSegment> = new Map();
  private publishRecords: Map<string, PublishRecord> = new Map();
  private statusHistories: Map<string, StatusHistory> = new Map();

  createSegment(
    name: string,
    description: string,
    ruleVersion: string,
    audienceCount: number,
    operator: string
  ): AudienceSegment {
    const now = new Date();
    const segment: AudienceSegment = {
      id: uuidv4(),
      name,
      description,
      ruleVersion,
      status: SegmentStatus.DRAFT,
      audienceCount,
      createdBy: operator,
      createdAt: now,
      updatedBy: operator,
      updatedAt: now
    };
    this.segments.set(segment.id, segment);
    
    this.addHistory({
      segmentId: segment.id,
      operation: OperationType.CREATE,
      toStatus: SegmentStatus.DRAFT,
      operator,
      operateAt: now,
      remark: '创建人群包'
    });

    return segment;
  }

  getSegment(id: string): AudienceSegment | undefined {
    return this.segments.get(id);
  }

  listSegments(): AudienceSegment[] {
    return Array.from(this.segments.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  updateSegmentStatus(
    segmentId: string,
    newStatus: SegmentStatus,
    operator: string,
    remark?: string
  ): AudienceSegment {
    const segment = this.segments.get(segmentId);
    if (!segment) {
      throw new Error('人群包不存在');
    }

    const oldStatus = segment.status;
    segment.status = newStatus;
    segment.updatedBy = operator;
    segment.updatedAt = new Date();

    if (newStatus === SegmentStatus.PUBLISHED) {
      segment.publishedAt = segment.updatedAt;
    } else if (newStatus === SegmentStatus.REVOKED) {
      segment.revokedAt = segment.updatedAt;
    }

    return segment;
  }

  createPublishRecord(
    segmentId: string,
    segmentName: string,
    ruleVersion: string,
    channel: ChannelType,
    channelAccount: string,
    audienceCount: number,
    publishedBy: string
  ): PublishRecord {
    const now = new Date();
    const record: PublishRecord = {
      id: uuidv4(),
      segmentId,
      segmentName,
      ruleVersion,
      channel,
      channelAccount,
      status: SegmentStatus.PUBLISHED,
      audienceCount,
      isRevoking: false,
      isRevoked: false,
      publishedBy,
      publishedAt: now
    };
    this.publishRecords.set(record.id, record);
    return record;
  }

  getPublishRecord(id: string): PublishRecord | undefined {
    return this.publishRecords.get(id);
  }

  listPublishRecords(segmentId?: string): PublishRecord[] {
    let records = Array.from(this.publishRecords.values());
    if (segmentId) {
      records = records.filter(r => r.segmentId === segmentId);
    }
    return records.sort((a, b) => 
      b.publishedAt.getTime() - a.publishedAt.getTime()
    );
  }

  updatePublishRecordForRevoke(
    recordId: string,
    reason: RevokeReason,
    remark: string,
    requestedBy: string
  ): PublishRecord {
    const record = this.publishRecords.get(recordId);
    if (!record) {
      throw new Error('发布记录不存在');
    }

    record.isRevoking = true;
    record.status = SegmentStatus.REVOKING;
    record.revokeReason = reason;
    record.revokeRemark = remark;
    record.revokeRequestedBy = requestedBy;
    record.revokeRequestedAt = new Date();

    return record;
  }

  completePublishRecordRevoke(recordId: string, handlerInfo?: string): PublishRecord {
    const record = this.publishRecords.get(recordId);
    if (!record) {
      throw new Error('发布记录不存在');
    }

    record.isRevoking = false;
    record.isRevoked = true;
    record.status = SegmentStatus.REVOKED;
    record.revokeCompletedAt = new Date();

    return record;
  }

  addHistory(history: Omit<StatusHistory, 'id'>): StatusHistory {
    const fullHistory: StatusHistory = {
      id: uuidv4(),
      ...history
    };
    this.statusHistories.set(fullHistory.id, fullHistory);
    return fullHistory;
  }

  listHistories(segmentId?: string, publishRecordId?: string): StatusHistory[] {
    let histories = Array.from(this.statusHistories.values());
    if (segmentId) {
      histories = histories.filter(h => h.segmentId === segmentId);
    }
    if (publishRecordId) {
      histories = histories.filter(h => h.publishRecordId === publishRecordId);
    }
    return histories.sort((a, b) => 
      a.operateAt.getTime() - b.operateAt.getTime()
    );
  }

  clear(): void {
    this.segments.clear();
    this.publishRecords.clear();
    this.statusHistories.clear();
  }
}

export const store = new DataStore();
