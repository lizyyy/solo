import {
  ComplaintRecord,
  ComplaintStatus,
  HeatmapInfo,
  OperationType,
} from '../types';
import { dataStore } from '../store';
import { StatusManager } from './status-manager';
import {
  shouldPendingReview,
  isMissingSamplingCausingLow,
  BoundaryRules,
} from '../boundary-rules';
import { now } from '../utils';

export class HeatmapService {
  static updateHeatmap(
    recordId: string,
    odorLevel: number,
    isMissingSampling: boolean,
    samplingTime: string,
    operator: string
  ): ComplaintRecord | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    const isLowDueToMissing = isMissingSamplingCausingLow(
      odorLevel,
      isMissingSampling
    );

    const heatmapInfo: HeatmapInfo = {
      odorLevel,
      samplingTime,
      isMissingSampling,
      isLowDueToMissing,
    };

    record.heatmap = heatmapInfo;
    dataStore.saveRecord(record);

    const targetStatus = shouldPendingReview(isMissingSampling, odorLevel)
      ? ComplaintStatus.HEATMAP_PENDING_REVIEW
      : ComplaintStatus.HEATMAP_NORMAL;

    const remark = isLowDueToMissing
      ? `夜间缺采样，热力值偏低(${odorLevel})，待街道规划员复核`
      : `热力值更新: ${odorLevel}`;

    const updated = StatusManager.transitionStatus(
      record.id,
      targetStatus,
      OperationType.UPDATE_HEATMAP,
      operator,
      remark
    );

    return updated;
  }

  static reviewHeatmap(
    recordId: string,
    isNormal: boolean,
    reviewNote: string,
    reviewer: string
  ): ComplaintRecord | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    if (record.currentStatus !== ComplaintStatus.HEATMAP_PENDING_REVIEW) {
      throw new Error('该记录不处于待复核状态');
    }

    if (!record.heatmap) {
      throw new Error('该记录没有热力图数据');
    }

    record.heatmap.reviewNote = reviewNote;
    record.heatmap.reviewedBy = reviewer;
    record.heatmap.reviewedAt = now();
    dataStore.saveRecord(record);

    const targetStatus = isNormal
      ? ComplaintStatus.REVIEWED_NORMAL
      : ComplaintStatus.REVIEWED_ABNORMAL;

    const updated = StatusManager.transitionStatus(
      record.id,
      targetStatus,
      OperationType.REVIEW_HEATMAP,
      reviewer,
      `复核结论: ${isNormal ? '正常' : '异常'}, 备注: ${reviewNote}`
    );

    return updated;
  }

  static getDisplayOdorLevel(record: ComplaintRecord): number {
    if (!record.heatmap) return 0;

    if (record.heatmap.isMissingSampling) {
      if (
        record.currentStatus === ComplaintStatus.HEATMAP_PENDING_REVIEW ||
        record.currentStatus === ComplaintStatus.REVIEWED_ABNORMAL
      ) {
        return BoundaryRules.heatmap.missingSamplingDisplayLevel;
      }
      if (record.currentStatus === ComplaintStatus.REVIEWED_NORMAL) {
        return record.heatmap.odorLevel;
      }
    }

    return record.heatmap.odorLevel;
  }

  static getPendingReviewRecords(): ComplaintRecord[] {
    return dataStore
      .getAllRecords()
      .filter(r => r.currentStatus === ComplaintStatus.HEATMAP_PENDING_REVIEW);
  }
}
