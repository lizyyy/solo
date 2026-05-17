import {
  SegmentStatus,
  OperationType,
  ChannelType,
  RevokeReason,
  AudienceSegment,
  PublishRecord
} from './types';
import { store } from './store';

export class StateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateValidationError';
  }
}

export class IdempotentOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotentOperationError';
  }
}

const allowedTransitions = new Map<SegmentStatus, Set<SegmentStatus>>([
  [SegmentStatus.DRAFT, new Set<SegmentStatus>([SegmentStatus.PUBLISHED])],
  [SegmentStatus.PUBLISHED, new Set<SegmentStatus>([SegmentStatus.REVOKING])],
  [SegmentStatus.REVOKING, new Set<SegmentStatus>([SegmentStatus.REVOKED, SegmentStatus.PUBLISHED])],
  [SegmentStatus.REVOKED, new Set<SegmentStatus>([SegmentStatus.PUBLISHED])]
]);

export function validateStateTransition(
  fromStatus: SegmentStatus,
  toStatus: SegmentStatus
): boolean {
  const allowed = allowedTransitions.get(fromStatus);
  return allowed ? allowed.has(toStatus) : false;
}

export function publishSegment(
  segmentId: string,
  channels: Array<{ channel: ChannelType; channelAccount: string }>,
  operator: string
): { segment: AudienceSegment; records: PublishRecord[] } {
  const segment = store.getSegment(segmentId);
  if (!segment) {
    throw new StateValidationError('人群包不存在');
  }

  if (segment.status === SegmentStatus.PUBLISHED) {
    throw new IdempotentOperationError('人群包已发布，请勿重复操作');
  }

  if (!validateStateTransition(segment.status, SegmentStatus.PUBLISHED)) {
    throw new StateValidationError(`状态不合法: ${segment.status} 无法发布`);
  }

  const updatedSegment = store.updateSegmentStatus(
    segmentId,
    SegmentStatus.PUBLISHED,
    operator,
    '发布人群包'
  );

  store.addHistory({
    segmentId,
    operation: OperationType.PUBLISH,
    fromStatus: segment.status,
    toStatus: SegmentStatus.PUBLISHED,
    operator,
    operateAt: new Date(),
    remark: `发布到 ${channels.length} 个渠道: ${channels.map(c => c.channel).join(', ')}`
  });

  const records: PublishRecord[] = [];
  for (const channelInfo of channels) {
    const record = store.createPublishRecord(
      segmentId,
      segment.name,
      segment.ruleVersion,
      channelInfo.channel,
      channelInfo.channelAccount,
      segment.audienceCount,
      operator
    );
    records.push(record);

    store.addHistory({
      segmentId,
      publishRecordId: record.id,
      operation: OperationType.PUBLISH,
      toStatus: SegmentStatus.PUBLISHED,
      operator,
      operateAt: new Date(),
      remark: `发布到 ${channelInfo.channel}`,
      channel: channelInfo.channel
    });
  }

  return { segment: updatedSegment, records };
}

export function requestRevokePublish(
  segmentId: string,
  reason: RevokeReason,
  remark: string,
  operator: string,
  specificRecordIds?: string[]
): { segment: AudienceSegment; records: PublishRecord[] } {
  const segment = store.getSegment(segmentId);
  if (!segment) {
    throw new StateValidationError('人群包不存在');
  }

  if (segment.status === SegmentStatus.REVOKED) {
    throw new IdempotentOperationError('人群包已撤销，请勿重复操作');
  }

  if (segment.status === SegmentStatus.REVOKING) {
    throw new IdempotentOperationError('人群包撤销中，请勿重复操作');
  }

  if (segment.status !== SegmentStatus.PUBLISHED) {
    throw new StateValidationError(`状态不合法: ${segment.status} 无法撤销`);
  }

  let recordsToRevoke = store.listPublishRecords(segmentId).filter(
    r => r.status === SegmentStatus.PUBLISHED && !r.isRevoking && !r.isRevoked
  );

  if (specificRecordIds && specificRecordIds.length > 0) {
    recordsToRevoke = recordsToRevoke.filter(r => specificRecordIds.includes(r.id));
    if (recordsToRevoke.length === 0) {
      throw new StateValidationError('没有可撤销的发布记录');
    }
  }

  if (recordsToRevoke.length === 0) {
    throw new StateValidationError('没有可撤销的发布记录');
  }

  const updatedSegment = store.updateSegmentStatus(
    segmentId,
    SegmentStatus.REVOKING,
    operator,
    `撤销原因: ${reason}`
  );

  store.addHistory({
    segmentId,
    operation: OperationType.REVOKE_REQUEST,
    fromStatus: SegmentStatus.PUBLISHED,
    toStatus: SegmentStatus.REVOKING,
    operator,
    operateAt: new Date(),
    remark: `申请撤销。原因: ${reason}, 备注: ${remark || '无'}`,
    exceptionInfo: specificRecordIds ? '部分撤销' : '全部撤销'
  });

  const revokedRecords: PublishRecord[] = [];
  for (const record of recordsToRevoke) {
    const updatedRecord = store.updatePublishRecordForRevoke(
      record.id,
      reason,
      remark,
      operator
    );
    revokedRecords.push(updatedRecord);

    store.addHistory({
      segmentId,
      publishRecordId: record.id,
      operation: OperationType.REVOKE_REQUEST,
      fromStatus: SegmentStatus.PUBLISHED,
      toStatus: SegmentStatus.REVOKING,
      operator,
      operateAt: new Date(),
      remark: `申请撤销 ${record.channel}`,
      channel: record.channel
    });
  }

  return { segment: updatedSegment, records: revokedRecords };
}

export function completeRevokePublish(
  segmentId: string,
  operator: string,
  handlerInfo?: string,
  exceptions?: Array<{ recordId: string; error: string }>
): { segment: AudienceSegment; records: PublishRecord[] } {
  const segment = store.getSegment(segmentId);
  if (!segment) {
    throw new StateValidationError('人群包不存在');
  }

  if (segment.status === SegmentStatus.REVOKED) {
    throw new IdempotentOperationError('人群包已撤销，请勿重复操作');
  }

  if (segment.status !== SegmentStatus.REVOKING) {
    throw new StateValidationError(`状态不合法: ${segment.status} 无法完成撤销`);
  }

  const revokingRecords = store.listPublishRecords(segmentId).filter(
    r => r.isRevoking && !r.isRevoked
  );

  const exceptionMap = new Map(
    (exceptions || []).map(e => [e.recordId, e.error])
  );

  const completedRecords: PublishRecord[] = [];
  for (const record of revokingRecords) {
    const error = exceptionMap.get(record.id);
    if (error) {
      store.addHistory({
        segmentId,
        publishRecordId: record.id,
        operation: OperationType.EXCEPTION_HANDLE,
        fromStatus: SegmentStatus.REVOKING,
        toStatus: SegmentStatus.REVOKING,
        operator,
        operateAt: new Date(),
        remark: `渠道 ${record.channel} 撤销异常`,
        channel: record.channel,
        exceptionInfo: error,
        handlerInfo
      });
      continue;
    }

    const updatedRecord = store.completePublishRecordRevoke(record.id, handlerInfo);
    completedRecords.push(updatedRecord);

    store.addHistory({
      segmentId,
      publishRecordId: record.id,
      operation: OperationType.REVOKE_COMPLETE,
      fromStatus: SegmentStatus.REVOKING,
      toStatus: SegmentStatus.REVOKED,
      operator,
      operateAt: new Date(),
      remark: `完成撤销 ${record.channel}`,
      channel: record.channel,
      handlerInfo
    });
  }

  const stillRevoking = store.listPublishRecords(segmentId).some(
    r => r.isRevoking && !r.isRevoked
  );

  if (!stillRevoking) {
    const finalSegment = store.updateSegmentStatus(
      segmentId,
      SegmentStatus.REVOKED,
      operator,
      '撤销完成'
    );

    store.addHistory({
      segmentId,
      operation: OperationType.REVOKE_COMPLETE,
      fromStatus: SegmentStatus.REVOKING,
      toStatus: SegmentStatus.REVOKED,
      operator,
      operateAt: new Date(),
      remark: '所有渠道撤销完成',
      handlerInfo
    });

    return { segment: finalSegment, records: completedRecords };
  }

  store.addHistory({
    segmentId,
    operation: OperationType.REVOKE_PROCESS,
    fromStatus: SegmentStatus.REVOKING,
    toStatus: SegmentStatus.REVOKING,
    operator,
    operateAt: new Date(),
    remark: `部分渠道撤销完成，仍有 ${revokingRecords.length - completedRecords.length} 个渠道处理中`,
    handlerInfo
  });

  return { segment, records: completedRecords };
}

export function handleChannelException(
  publishRecordId: string,
  errorMessage: string,
  discoveredBy: string,
  handlerInfo?: string
): PublishRecord {
  const record = store.getPublishRecord(publishRecordId);
  if (!record) {
    throw new StateValidationError('发布记录不存在');
  }

  store.addHistory({
    segmentId: record.segmentId,
    publishRecordId: record.id,
    operation: OperationType.EXCEPTION_HANDLE,
    fromStatus: record.status,
    toStatus: record.status,
    operator: discoveredBy,
    operateAt: new Date(),
    remark: `发现异常: ${record.channel} 仍在投放`,
    channel: record.channel,
    exceptionInfo: errorMessage,
    handlerInfo
  });

  return record;
}
